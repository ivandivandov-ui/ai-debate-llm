import type { PipelineState } from "../contracts/state";
import type { Task, TaskResult } from "../contracts/task";
import type { AgentId, SessionId } from "../contracts/message";
import { getPrompt } from "./prompts";
import { ProviderRouter } from "../../providers/router/provider-router";
import { createAgentState } from "../../agents/base/agent-state";

export interface CollectStageConfig {
  taskTimeout: number;
  aggregateResults: boolean;
  failFast: boolean;
  enableParallel: boolean;
  maxConcurrentTasks: number;
  defaultProvider?: string;
}

export class CollectStage {
  private config: CollectStageConfig;
  private providerRouter?: ProviderRouter;
  private defaultProvider?: string;
  private rateLimitedProviders = new Map<string, number>(); // Name -> Expiry Time

  constructor(config?: Partial<CollectStageConfig>) {
    this.config = {
      taskTimeout: 60000,
      aggregateResults: true,
      failFast: false,
      enableParallel: true,
      maxConcurrentTasks: 5,
      ...config,
    };
    this.defaultProvider = this.config.defaultProvider;
  }

  setProviderRouter(router: ProviderRouter): void {
    this.providerRouter = router;
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    const tasks = state.tasks;
    let results: TaskResult[];

    if (this.config.enableParallel && tasks.length > 1) {
      results = await this.executeParallel(tasks, state, signal);
    } else {
      results = await this.executeSequential(tasks, state, signal);
    }

    return {
      ...state,
      results,
      history: [
        ...state.history,
        {
          stage: "collect",
          timestamp: Date.now(),
          input: `${tasks.length} tasks`,
          output: `${results.length} results (${results.filter(r => r.success).length} successful)`,
        },
      ],
      updatedAt: Date.now(),
    };
  }

  private async executeSequential(tasks: Task[], state: PipelineState, signal?: AbortSignal): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    for (const task of tasks) {
      if (signal?.aborted) throw new Error("ABORTED");
      try {
        const result = await this.executeTask(task, state, signal);
        results.push(result);
        if (this.config.failFast && !result.success) break;
      } catch (error) {
        results.push({
          taskId: task.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          metrics: { tokensUsed: 0, latencyMs: 0, cost: 0, provider: "unknown" },
        });
        if (this.config.failFast) break;
      }
    }
    return results;
  }

  private async executeParallel(tasks: Task[], state: PipelineState, signal?: AbortSignal): Promise<TaskResult[]> {
    const chunks: Task[][] = [];
    for (let i = 0; i < tasks.length; i += this.config.maxConcurrentTasks) {
      chunks.push(tasks.slice(i, i + this.config.maxConcurrentTasks));
    }

    const chunkResults: TaskResult[][] = [];
    for (const chunk of chunks) {
      if (signal?.aborted) throw new Error("ABORTED");
      const promises = chunk.map(task => 
        this.executeTask(task, state, signal).catch(error => ({
          taskId: task.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          metrics: { tokensUsed: 0, latencyMs: 0, cost: 0, provider: "unknown" },
        }))
      );
      const results = await Promise.all(promises);
      chunkResults.push(results);
    }

    return chunkResults.flat();
  }

  private async executeTask(task: Task, pipelineState: PipelineState, signal?: AbortSignal): Promise<TaskResult> {
    const role =
      task.type === "build" ? "builder" :
      task.type === "verify" ? "verifier" :
      task.type === "critique" ? "critic" :
      task.type === "research" ? "scientist" :
      "builder";

    try {
      const { createAgentFactory } = await import("../../agents/base/agent-factory");
      const factory = createAgentFactory();
      
      // Create agent with specific role for the task
      const agent = await factory.create({
        id: `agent-${task.id}` as any,
        role: role as any,
        sessionId: pipelineState.sessionId as any,
        name: `${role}-agent`,
        provider: this.defaultProvider,
      });

      if (this.providerRouter) {
        agent.setProviderRouter(this.providerRouter);
      }

      const { result } = await agent.execute({ task, signal });
      return result;
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          tokensUsed: 0,
          latencyMs: 0,
          cost: 0,
          provider: "error",
        },
      };
    }
  }

  private getSystemPrompt(taskType: string): string {
    const promptMap: Record<string, any> = {
      build: "build",
      verify: "verify",
      critique: "critique",
      analyze: "analyze",
      research: "research",
    };
    return getPrompt(promptMap[taskType] || "build");
  }
}
