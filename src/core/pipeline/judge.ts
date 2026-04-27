import type { PipelineState } from "../contracts/state";
import { JudgeAgent } from "../../agents/roles/judge.agent";
import { createAgentState } from "../../agents/base/agent-state";
import { getPrompt } from "../pipeline/prompts";
import { logger } from "../../observability/logging";

export interface JudgeStageConfig {
  enabled: boolean;
  minScoreThreshold: number;
}

export class JudgeStage {
  private config: JudgeStageConfig;

  constructor(config?: Partial<JudgeStageConfig>) {
    this.config = {
      enabled: true,
      minScoreThreshold: 7,
      ...config,
    };
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    if (signal?.aborted) throw new Error("ABORTED");
    if (!this.config.enabled || !state.synthesis.final) {
      return state;
    }

    try {
      const agentState = createAgentState(
        `judge-${state.sessionId}` as any,
        {
          id: `judge-${state.sessionId}` as any,
          role: "judge",
          sessionId: state.sessionId as any,
          systemPrompt: getPrompt("judge"),
          maxTokens: 4096,
          temperature: 0.7,
          provider: "default",
        }
      );

      const agent = new JudgeAgent(agentState);
      
      const task = {
        id: `judge-${Date.now()}`,
        type: "verify" as const, // Close enough for the interface
        description: `Evaluate the following final answer for the query: "${state.request.query}"\n\nAnswer: ${state.synthesis.final.content}`,
        input: state.synthesis.final.content,
      };

      const { result } = await agent.execute({ task, signal });

      return {
        ...state,
        results: [...state.results, result],
        history: [
          ...state.history,
          {
            stage: "judge" as any,
            timestamp: Date.now(),
            input: state.synthesis.final.content,
            output: typeof result.output === "string" ? result.output : JSON.stringify(result.output),
          },
        ],
        updatedAt: Date.now(),
      };
    } catch (error) {
      logger.error("[JudgeStage] Evaluation failed:", { error: String(error) });
      return state;
    }
  }
}
