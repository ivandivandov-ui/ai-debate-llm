import type { PipelineState } from "../contracts/state";
import type { DebateRequest } from "../contracts/request";

export interface InputStageConfig {
  maxQueryLength: number;
  enablePreprocessing: boolean;
  normalizeWhitespace: boolean;
}

export class InputStage {
  private config: InputStageConfig;

  constructor(config?: Partial<InputStageConfig>) {
    this.config = {
      maxQueryLength: 10000,
      enablePreprocessing: true,
      normalizeWhitespace: true,
      ...config,
    };
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    if (signal?.aborted) throw new Error("ABORTED");
    const query = state.request.query;

    if (!query || query.trim().length === 0) {
      throw new Error("EMPTY_QUERY: Query cannot be empty");
    }

    if (query.length > this.config.maxQueryLength) {
      throw new Error(`QUERY_TOO_LONG: Query exceeds ${this.config.maxQueryLength} characters`);
    }

    let processedQuery = query;
    if (this.config.enablePreprocessing) {
      if (this.config.normalizeWhitespace) {
        processedQuery = query.replace(/\s+/g, " ").trim();
      }
    }

    return {
      ...state,
      request: {
        ...state.request,
        query: processedQuery,
      },
      history: [
        ...state.history,
        {
          stage: "input",
          timestamp: Date.now(),
          input: query,
          output: processedQuery,
        },
      ],
      updatedAt: Date.now(),
    };
  }
}