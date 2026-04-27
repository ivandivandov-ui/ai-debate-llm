import type { AgentId, SessionId } from "../../core/contracts/message";
import type { Task, TaskResult } from "../../core/contracts/task";
import type { IAgent, AgentInput, AgentOutput, AgentSnapshot } from "../base/agent.interface";
import type { AgentState } from "../base/agent-state";
import { ProviderRouter } from "../../providers/router/provider-router";

export class CreativeAgent implements IAgent {
  readonly id: AgentId;
  readonly role = "builder" as const;
  readonly sessionId: SessionId;
  readonly capabilities = { canUseTools: true, canCommunicate: true, canVerify: false, maxConcurrentTasks: 3 };

  private state: AgentState;
  private initialized = false;
  private providerRouter?: ProviderRouter;
  private status: "idle" | "initialized" | "running" | "terminated" = "idle";
  private lastExecution?: number;
  private tasksCompleted = 0;
  private errorsCount = 0;

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

  async execute(input: AgentInput): Promise<AgentOutput> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.status = "running";
    const result = await this.generateCreative(input.task);

    this.lastExecution = Date.now();
    if (result.success) {
      this.tasksCompleted++;
    } else {
      this.errorsCount++;
    }
    this.status = "idle";

    return { result };
  }

  private async generateCreative(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const content = String(task.input);

    try {
      let output: unknown;
      let provider = "mock";
      let tokensUsed = 0;
      let cost = 0;

      if (this.providerRouter) {
        const provider_ = this.providerRouter.selectProvider({});
        if (provider_) {
          const messages = [
            { role: "system" as const, content: `You are a Creative agent. Your role is to generate innovative solutions and creative alternatives.
            
Provide:
1. Multiple approaches
2. Innovative variations
3. Novel perspectives
4. Creative solutions
5. Out-of-the-box thinking` },
            { role: "user" as const, content },
          ];
          const response = await provider_.chat(messages);
          output = response.content;
          tokensUsed = response.usage.totalTokens;
          cost = (response.usage.inputTokens * 0.00025 / 1000) + (response.usage.outputTokens * 0.001 / 1000);
          provider = provider_.name;
        }
      } else {
        output = this.generateFallbackCreative(content);
      }

      return {
        taskId: task.id,
        success: true,
        output,
        metrics: { tokensUsed, latencyMs: Date.now() - startTime, cost, provider },
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: { tokensUsed: 0, latencyMs: Date.now() - startTime, cost: 0, provider: "error" },
      };
    }
  }

  private generateFallbackCreative(content: string): string {
    return `# Creative Solutions

## Input
${content.substring(0, 100)}...

## Approaches
1. **Conventional** - Standard solution
2. **Innovative** - Novel approach
3. **Hybrid** - Combined methodology

## Creative Alternatives
- Consider multiple perspectives
- Explore edge cases
- Think laterally

## Note
Enable LLM for full creative capabilities.
`;
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
}