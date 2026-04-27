import type { AgentId, SessionId } from "../../core/contracts/message";
import type { Task, TaskResult } from "../../core/contracts/task";
import type { IAgent, AgentConfig, AgentInput, AgentOutput, AgentCapabilities } from "./agent.interface";
import { createAgentState, type AgentState, type AgentLifecycleState } from "./agent-state";
import { transitionState } from "./agent-state";
import { ToolExecutor } from "../tools/executor";
import { ToolRegistry } from "../tools/tool-registry";

export interface AgentRunnerConfig {
  defaultMaxTokens: number;
  defaultTemperature: number;
  defaultTimeout: number;
  enableStreaming: boolean;
  maxRetries: number;
}

export class AgentRunner {
  private config: AgentRunnerConfig;
  private toolExecutor: ToolExecutor;
  private toolRegistry: ToolRegistry;

  constructor(config?: Partial<AgentRunnerConfig>) {
    this.config = {
      defaultMaxTokens: 4096,
      defaultTemperature: 0.7,
      defaultTimeout: 60000,
      enableStreaming: false,
      maxRetries: 3,
      ...config,
    };
    this.toolRegistry = new ToolRegistry();
    this.toolExecutor = new ToolExecutor(this.toolRegistry);
  }

  async runTask(task: Task, state: AgentState): Promise<TaskResult> {
    const startTime = Date.now();
    const stateWithTask = transitionState(state, "processing");

    try {
      let output: unknown;

      if (state.tools.length > 0) {
        output = await this.runWithTools(task, state);
      } else {
        output = task.input;
      }

      return {
        taskId: task.id,
        success: true,
        output,
        metrics: {
          tokensUsed: 0,
          latencyMs: Date.now() - startTime,
          cost: 0,
          provider: state.context.provider,
        },
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          tokensUsed: 0,
          latencyMs: Date.now() - startTime,
          cost: 0,
          provider: state.context.provider,
        },
      };
    }
  }

  private async runWithTools(task: Task, state: AgentState): Promise<unknown> {
    const outputs: unknown[] = [];

    for (const toolId of state.tools) {
      const result = await this.toolExecutor.execute({ toolName: toolId, arguments: { input: task.input } });
      outputs.push(result);
    }

    return outputs.length === 1 ? outputs[0] : outputs;
  }

  async runWithRetry(task: Task, state: AgentState): Promise<TaskResult> {
    let lastError: Error | undefined;
    let attempts = 0;

    while (attempts < this.config.maxRetries) {
      try {
        return await this.runTask(task, state);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts++;

        if (attempts < this.config.maxRetries) {
          await this.delay(Math.pow(2, attempts) * 1000);
        }
      }
    }

    return {
      taskId: task.id,
      success: false,
      error: lastError?.message ?? "Max retries exceeded",
      metrics: {
        tokensUsed: 0,
        latencyMs: 0,
        cost: 0,
        provider: state.context.provider,
      },
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  setToolExecutor(executor: ToolExecutor): void {
    this.toolExecutor = executor;
  }
}