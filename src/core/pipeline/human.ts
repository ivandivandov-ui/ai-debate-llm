import type { PipelineState } from "../contracts/state";
import { logger } from "../../observability/logging";

/**
 * HumanStage - A pipeline stage that pauses execution to wait for human intervention.
 * This can be used for approvals, corrections, or steering the debate.
 */
export class HumanStage {
  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    logger.info(`[HumanStage] Debate ${state.sessionId} is now waiting for human input.`);
    
    // If we already have human input, it means we are resuming
    if (state.humanInput) {
      logger.info(`[HumanStage] Resuming debate ${state.sessionId} with human input: ${state.humanInput.substring(0, 50)}...`);
      
      // Add to history
      state.history.push({
        stage: "human",
        timestamp: Date.now(),
        input: "Human review requested",
        output: state.humanInput,
      });
      
      // Clear human input for next potential human stage
      const input = state.humanInput;
      state.humanInput = undefined;
      state.stopped = false;
      state.stopReason = undefined;
      
      // Logic: How to apply human input?
      // For now, let's just add it as a system message or a "result"
      state.results.push({
        taskId: `human-${Date.now()}`,
        success: true,
        output: `[Human Feedback] ${input}`,
        metrics: { tokensUsed: 0, latencyMs: 0, cost: 0, provider: "human" }
      });

      return state;
    }

    // Otherwise, pause the pipeline
    return {
      ...state,
      stopped: true,
      stopReason: "waiting_for_human",
      updatedAt: Date.now(),
    };
  }
}
