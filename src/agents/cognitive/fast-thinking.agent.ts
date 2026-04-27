import type { AgentId, SessionId } from "../../core/contracts/message";
import type { Task, TaskResult } from "../../core/contracts/task";
import type { IAgent, AgentInput, AgentOutput, AgentSnapshot } from "../base/agent.interface";
import type { AgentState } from "../base/agent-state";
import { ProviderRouter } from "../../providers/router/provider-router";

export class FastThinkingAgent implements IAgent {
  readonly id: AgentId;
  readonly role = "builder" as const;
  readonly sessionId: SessionId;
  readonly capabilities = { canUseTools: false, canCommunicate: true, canVerify: false };

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
    const result = await this.processQuick(input.task);

    this.lastExecution = Date.now();
    if (result.success) {
      this.tasksCompleted++;
    } else {
      this.errorsCount++;
    }
    this.status = "idle";

    return { result };
  }

  private async processQuick(task: Task): Promise<TaskResult> {
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
            { role: "system" as const, content: "You are a fast-thinking agent. Provide quick, concise responses." },
            { role: "user" as const, content },
          ];
          const response = await provider_.chat(messages);
          output = response.content;
          tokensUsed = response.usage.totalTokens;
          cost = (response.usage.inputTokens * 0.00025 / 1000) + (response.usage.outputTokens * 0.001 / 1000);
          provider = provider_.name;
        }
      } else {
        output = `Fast analysis: ${content.substring(0, 100)}...`;
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