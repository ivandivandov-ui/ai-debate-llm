import type { AgentId, AgentRole, SessionId } from "../../core/contracts/message";
import type { Task, TaskResult } from "../../core/contracts/task";
import type { IAgent, AgentInput, AgentOutput, AgentSnapshot, AgentCapabilities } from "./agent.interface";
import type { AgentState } from "./agent-state";
import { ProviderRouter } from "../../providers/router/provider-router";
import type { ProviderMessage } from "../../providers/base/provider.interface";
import { GlobalRegistry } from "../../core/global-registry";
import { logger } from "../../observability/logging";
import { getBestModel } from "../../config/models";

/**
 * Shared rate-limiting state across all agents in the process.
 */
const rateLimitedProviders = new Map<string, number>();

/**
 * Base class for all agents in the Synthesis Debate System.
 * Encapsulates common logic for provider selection, retries, and LLM communication.
 */
export abstract class BaseAgent implements IAgent {
  /**
   * Shared rate-limiting state across all agents in the process.
   */
  protected static rateLimitedProviders = new Map<string, number>();

  /**
   * Cleans up expired rate limit entries to prevent memory leaks.
   */
  static cleanupRateLimits(): void {
    const now = Date.now();
    for (const [provider, expiry] of this.rateLimitedProviders) {
      if (now >= expiry) {
        this.rateLimitedProviders.delete(provider);
      }
    }
  }
  readonly id: AgentId;
  abstract readonly role: AgentRole;
  readonly sessionId: SessionId;
  abstract readonly capabilities: AgentCapabilities;

  protected state: AgentState;
  protected initialized = false;
  protected providerRouter?: ProviderRouter;
  protected status: "idle" | "initialized" | "running" | "terminated" = "idle";
  protected lastExecution?: number;
  protected tasksCompleted = 0;
  protected errorsCount = 0;

  constructor(state: AgentState) {
    this.id = state.id;
    this.sessionId = state.context.sessionId;
    this.state = state;
  }

  setProviderRouter(router: ProviderRouter): void {
    this.providerRouter = router;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    this.status = "initialized";
  }

  async terminate(): Promise<void> {
    this.status = "terminated";
  }

  getState(): AgentSnapshot {
    return {
      id: this.id,
      role: this.role,
      status: this.status,
      lastExecution: this.lastExecution,
      tasksCompleted: this.tasksCompleted,
      errorsCount: this.errorsCount,
    };
  }

  /**
   * Main entry point for executing an agent task.
   * Handles lifecycle management and delegates to performTask.
   */
  async execute(input: AgentInput): Promise<AgentOutput> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (input.signal?.aborted) {
      throw new Error("ABORTED: Agent execution was cancelled before start");
    }

    this.status = "running";
    try {
      const result = await this.performTask(input.task, input.context, input.signal);

      this.lastExecution = Date.now();
      if (result.success) {
        this.tasksCompleted++;
      } else {
        this.errorsCount++;
      }
      return { result };
    } catch (error) {
      this.errorsCount++;
      const message = error instanceof Error ? error.message : String(error);
      return {
        result: {
          taskId: input.task.id,
          success: false,
          error: message,
          metrics: { tokensUsed: 0, latencyMs: 0, cost: 0, provider: "error" },
        },
      };
    } finally {
      this.status = "idle";
    }
  }

  /**
   * Role-specific implementation of the task.
   */
  protected abstract performTask(task: Task, context?: Record<string, unknown>, signal?: AbortSignal): Promise<TaskResult>;

  /**
   * Helper to communicate with an LLM with built-in retries and provider switching.
   * This logic was previously duplicated in CollectStage.
   */
  protected async chatWithLLM(task: Task, systemPrompt: string, signal?: AbortSignal): Promise<TaskResult> {
    const startTime = Date.now();
    let providerName = "mock";
    let tokensUsed = 0;
    let cost = 0;
    let output: any;

    try {
      if (signal?.aborted) {
        throw new Error("ABORTED");
      }

      if (!this.providerRouter) {
        throw new Error("Provider router not initialized");
      }

      // 1. Select initial provider based on agent context
      const initialProvider = this.providerRouter.selectProvider({
        preferredProvider: this.state.context.provider || undefined,
      });

      if (!initialProvider) {
        throw new Error("No available providers");
      }

      // 2. Filter and rank providers to try (prefer selected, then groq, then others)
      const allProviders = this.providerRouter.getAllProviders()
        .filter(p => p.name !== "mock" && p.isAvailable());
      
      const providersToTry = [
        initialProvider, 
        ...allProviders.filter(p => p.name === "groq" && p.name !== initialProvider.name),
        ...allProviders.filter(p => p.name !== initialProvider.name && p.name !== "groq")
      ];

      // 3. Prepare messages and tools
      const currentCanvas = (this.state as any).canvasContent || "";
      const augmentedSystemPrompt = `${systemPrompt}\n\nSHARED WORKSPACE (CANVAS):\nThis is a shared document where you and the user collaborate. You can propose changes to it.\nCURRENT CANVAS CONTENT:\n\"\"\"\n${currentCanvas}\n\"\"\"\n\nTo update the canvas, use the 'update_shared_canvas' tool.`;

      const messages: ProviderMessage[] = [
        { role: "system", content: augmentedSystemPrompt },
        ...(task.context as any || []).map((m: any) => ({ 
          role: m.role as any, 
          content: m.content 
        }))
      ];

      // Add attachments to the first user message or as a new message
      const request = (this.state as any).request;
      if (request?.attachments && request.attachments.length > 0) {
        const attachmentBlocks: any[] = request.attachments.map((a: any) => {
          if (a.type.startsWith("image/")) {
            return {
              type: "image_url",
              image_url: { url: `data:${a.type};base64,${a.data}` }
            };
          } else {
            return {
              type: "text",
              text: `\n[Attachment: ${a.name}]\n${Buffer.from(a.data, "base64").toString("utf-8")}`
            };
          }
        });

        // Find the first user message or create one
        const userMsg = messages.find(m => m.role === "user");
        if (userMsg) {
          if (typeof userMsg.content === "string") {
            userMsg.content = [
              { type: "text", text: userMsg.content },
              ...attachmentBlocks
            ];
          } else if (Array.isArray(userMsg.content)) {
            userMsg.content.push(...attachmentBlocks);
          }
        } else {
          messages.push({
            role: "user",
            content: [
              { type: "text", text: String(task.input) },
              ...attachmentBlocks
            ]
          });
        }
      } else {
        messages.push({ role: "user", content: String(task.input) });
      }

      const registry = GlobalRegistry.getInstance();
      const tools = this.capabilities.canUseTools ? registry.getToolRegistry().getAll().map((t: any) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: "object",
            properties: t.inputSchema.properties || {},
            required: t.inputSchema.required || []
          }
        }
      })) : [];

      let success = false;
      let lastErrorMessage = "";

      for (const currentProvider of providersToTry) {
        if (signal?.aborted) throw new Error("ABORTED");

        // Check global rate limits
        const now = Date.now();
        const rateLimits = (this.constructor as typeof BaseAgent).rateLimitedProviders;
        if (rateLimits.has(currentProvider.name)) {
          const expiry = rateLimits.get(currentProvider.name)!;
          if (now < expiry) continue;
          else rateLimits.delete(currentProvider.name);
        }

        const currentModel = this.selectModelForRole(this.role, currentProvider);
        const modelsToTry = [currentModel, ...currentProvider.availableModels.filter((m: string) => m !== currentModel)];
        
        for (const tryModel of modelsToTry) {
          if (signal?.aborted) throw new Error("ABORTED");

          try {
            let response = await currentProvider.chat(messages, { 
              model: tryModel,
              tools: tools.length > 0 ? (tools as any) : undefined,
              signal 
            });

            // Handle tool calls loop
            let toolCallsCount = 0;
            const MAX_TOOL_CALLS = 5;

            while (response.finishReason === "tool_calls" && response.toolCalls && toolCallsCount < MAX_TOOL_CALLS) {
              toolCallsCount++;
              messages.push({
                role: "assistant",
                content: response.content || "",
                tool_calls: response.toolCalls as any
              } as any);

              for (const toolCall of response.toolCalls) {
                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  const result = await registry.getToolExecutor().execute({
                    toolName: toolCall.function.name,
                    arguments: args,
                    callId: toolCall.id
                  }, { sessionId: this.sessionId, agentId: this.id });

                  messages.push({
                    role: "tool",
                    content: typeof result.output === "string" ? result.output : JSON.stringify(result.output),
                    tool_call_id: toolCall.id
                  });
                } catch (toolError) {
                  const errorMessage = toolError instanceof Error ? toolError.message : String(toolError);
                  logger.warn(`[Agent:${this.id}] Tool call failed, attempting auto-healing:`, { error: errorMessage });
                  
                  messages.push({
                    role: "tool",
                    content: `ERROR: Tool execution failed. Reason: ${errorMessage}. Please correct your arguments and try again if necessary.`,
                    tool_call_id: toolCall.id
                  });
                }
              }

              response = await currentProvider.chat(messages, { model: tryModel, signal });
              tokensUsed += response.usage.totalTokens;
            }

            output = response.content;
            tokensUsed += response.usage.totalTokens;
            success = true;
            providerName = currentProvider.name;
            
            const modelInfo = currentProvider.getModel(tryModel);
            const latencyMs = Date.now() - startTime;
            cost = modelInfo 
              ? (response.usage.inputTokens * modelInfo.pricing.inputPer1k / 1000) + 
                (response.usage.outputTokens * modelInfo.pricing.outputPer1k / 1000)
              : (tokensUsed * 0.000001);

            // Report latency to router
            this.providerRouter.reportLatency(currentProvider.name, latencyMs);

            // Extract reasoning if present (e.g. <thinking>...</thinking>)
            let reasoning: string | undefined;
            const thinkingMatch = response.content.match(/<thinking>([\s\S]*?)<\/thinking>/);
            let finalContent = response.content;
            
            if (thinkingMatch) {
              reasoning = thinkingMatch[1].trim();
              finalContent = response.content.replace(/<thinking>[\s\S]*?<\/thinking>/, "").trim();
            }

            // Extract canvas updates from tags if any (as a fallback/supplement to tools)
            const canvasMatch = response.content.match(/<canvas>([\s\S]*?)<\/canvas>/);
            if (canvasMatch) {
              const { updateDebateCanvas } = await import("../../persistence/database");
              await updateDebateCanvas(this.sessionId, canvasMatch[1].trim());
            }

            // Persist message to DB
            await this.persistMessage(finalContent, task.type === "critique" ? "critique" : "argument", reasoning);
            
            break;
          } catch (e) {
            lastErrorMessage = e instanceof Error ? e.message : String(e);
            if (lastErrorMessage === "ABORTED") throw e;

            logger.warn(`Agent ${this.id} provider ${currentProvider.name} (model ${tryModel}) failed: ${lastErrorMessage}`, { error: lastErrorMessage });
            
            if (this.isRateLimitError(lastErrorMessage)) {
              const rateLimits = (this.constructor as typeof BaseAgent).rateLimitedProviders;
              rateLimits.set(currentProvider.name, Date.now() + 5 * 60 * 1000); // 5 min block
              break; // Try next provider
            }
          }
        }
        if (success) break;
      }

      if (!success) {
        // Final fallback: generate a mock response if everything failed
        logger.error(`All real providers failed for agent ${this.id}, using fallback mock.`);
        return this.getMockResult(task, startTime, lastErrorMessage || "All providers failed");
      }

      return {
        taskId: task.id,
        success: true,
        output,
        metrics: {
          tokensUsed,
          latencyMs: Date.now() - startTime,
          cost,
          provider: providerName,
        },
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        taskId: task.id,
        success: false,
        error: message,
        metrics: {
          tokensUsed: 0,
          latencyMs: Date.now() - startTime,
          cost: 0,
          provider: "error",
        },
      };
    }
  }

  private selectModelForRole(role: AgentRole, provider: any): string {
    const models = provider.availableModels as string[];
    if (models.length === 0) return "default";
    return getBestModel(role, models);
  }

  protected async persistMessage(content: string, type: string = "argument", reasoning?: string): Promise<void> {
    if (!this.sessionId) return;
    try {
      const { addDebateMessage } = await import("../../persistence/database");
      await addDebateMessage(this.sessionId, this.id, content, type, reasoning);
    } catch (error) {
      logger.error(`[Agent:${this.id}] Failed to persist message:`, { error: String(error) });
    }
  }

  private getMockResult(task: Task, startTime: number, reason: string): TaskResult {
    return {
      taskId: task.id,
      success: true,
      output: `[Fallback Mock] Due to: ${reason}\n\nTask: ${task.description}`,
      assumptions: [reason],
      metrics: {
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
        cost: 0,
        provider: "fallback-mock",
      },
    };
  }

  private isRateLimitError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes("429") || 
           normalized.includes("quota exceeded") || 
           normalized.includes("resource_exhausted") || 
           normalized.includes("rate limit");
  }
}
