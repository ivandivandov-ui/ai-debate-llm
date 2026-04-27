import type { PipelineState } from "../contracts/state";
import type { Task } from "../contracts/task";

export interface DispatchStageConfig {
  maxConcurrentTasks: number;
  defaultAgentMap: Record<string, string>;
  enableLoadBalancing: boolean;
}

export class DispatchStage {
  private config: DispatchStageConfig;

  constructor(config?: Partial<DispatchStageConfig>) {
    this.config = {
      maxConcurrentTasks: 5,
      defaultAgentMap: {
        analyze: "builder",
        build: "builder",
        verify: "verifier",
        critique: "critic",
        question: "scientist",
        synthesize: "builder",
        research: "scientist",
        refine: "skeptic",
      },
      enableLoadBalancing: true,
      ...config,
    };
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    if (signal?.aborted) throw new Error("ABORTED");
    const tasksWithAgents = state.tasks.map((task) => ({
      ...task,
      assignedAgent: this.config.defaultAgentMap[task.type] ?? "builder",
    }));

    return {
      ...state,
      tasks: tasksWithAgents,
      history: [
        ...state.history,
        {
          stage: "dispatch",
          timestamp: Date.now(),
          input: JSON.stringify(state.tasks),
          output: JSON.stringify(tasksWithAgents),
        },
      ],
      updatedAt: Date.now(),
    };
  }
}