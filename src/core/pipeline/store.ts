import type { PipelineState } from "../contracts/state";
import { shortTermMemory } from "../../memory/short-term";

export interface StoreStageConfig {
  persistSession: boolean;
  maxHistoryLength: number;
  compressHistory: boolean;
}

export class StoreStage {
  private config: StoreStageConfig;

  constructor(config?: Partial<StoreStageConfig>) {
    this.config = {
      persistSession: true,
      maxHistoryLength: 1000,
      compressHistory: false,
      ...config,
    };
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    if (signal?.aborted) throw new Error("ABORTED");
    if (this.config.persistSession) {
      await this.persistState(state);
    }

    return {
      ...state,
      history: this.truncateHistory(state.history),
      updatedAt: Date.now(),
    };
  }

  private async persistState(state: PipelineState): Promise<void> {
    const sessionData = {
      sessionId: state.sessionId,
      request: state.request,
      stage: state.stage,
      round: state.round,
      tasks: state.tasks,
      results: state.results,
      verification: state.verification,
      synthesis: state.synthesis,
      createdAt: state.createdAt,
      updatedAt: Date.now(),
    };

    shortTermMemory.set(state.sessionId, sessionData);
  }

  private truncateHistory(history: PipelineState["history"]) {
    if (history.length <= this.config.maxHistoryLength) {
      return history;
    }
    return history.slice(-this.config.maxHistoryLength);
  }
}