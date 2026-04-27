import type { PipelineState } from "../contracts/state";
import type { DebateResult } from "../contracts/result";

export interface OutputStageConfig {
  format: "json" | "text" | "markdown";
  includeEvidence: boolean;
  includeReasoning: boolean;
  confidenceThreshold: number;
}

export class OutputStage {
  private config: OutputStageConfig;

  constructor(config?: Partial<OutputStageConfig>) {
    this.config = {
      format: "json",
      includeEvidence: true,
      includeReasoning: true,
      confidenceThreshold: 0.5,
      ...config,
    };
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    if (signal?.aborted) throw new Error("ABORTED");
    const result = this.buildResult(state);

    return {
      ...state,
      history: [
        ...state.history,
        {
          stage: "output",
          timestamp: Date.now(),
          input: JSON.stringify(state.synthesis),
          output: result.finalAnswer,
        },
      ],
      updatedAt: Date.now(),
    };
  }

  private buildResult(state: PipelineState): DebateResult {
    const synthesis = state.synthesis;
    
    const bestCandidate = synthesis.candidates[0];
    const finalAnswer = bestCandidate?.content ?? "No result available";

    const totalTokens = state.results.reduce((sum, r) => sum + r.metrics.tokensUsed, 0);
    const totalCost = state.results.reduce((sum, r) => sum + r.metrics.cost, 0);
    const totalLatency = state.results.reduce((sum, r) => sum + r.metrics.latencyMs, 0);
    const providersUsed = [...new Set(state.results.map((r) => r.metrics.provider))];

    return {
      id: `result-${state.sessionId}`,
      requestId: state.request.id,
      query: state.request.query,
      finalAnswer,
      confidence: bestCandidate?.confidence ?? 0,
      evidence: [],
      reasoning: {
        steps: state.history.map((h, i) => ({
          id: `step-${i}`,
          description: h.stage,
          agentId: h.agentId ?? "system",
          timestamp: h.timestamp,
          input: h.input,
          output: h.output,
          type: "synthesis",
        })),
        conclusion: finalAnswer,
      },
      metrics: {
        totalTokens,
        totalCost,
        totalRounds: state.round,
        totalAgents: 1,
        executionTimeMs: totalLatency,
        providersUsed,
      },
    };
  }

  formatOutput(result: DebateResult): string {
    switch (this.config.format) {
      case "json":
        return JSON.stringify(result, null, 2);
      case "text":
        return this.formatText(result);
      case "markdown":
        return this.formatMarkdown(result);
      default:
        return JSON.stringify(result);
    }
  }

  private formatText(result: DebateResult): string {
    return `# ${result.query}

${result.finalAnswer}

Confidence: ${(result.confidence * 100).toFixed(1)}%
Rounds: ${result.metrics.totalRounds}
Cost: $${result.metrics.totalCost.toFixed(4)}
`;
  }

  private formatMarkdown(result: DebateResult): string {
    return `# Debate Result

## Query
${result.query}

## Answer
${result.finalAnswer}

## Metrics
- Confidence: ${(result.confidence * 100).toFixed(1)}%
- Rounds: ${result.metrics.totalRounds}
- Total Tokens: ${result.metrics.totalTokens}
- Cost: $${result.metrics.totalCost.toFixed(4)}
- Execution Time: ${(result.metrics.executionTimeMs / 1000).toFixed(2)}s

## Reasoning
${result.reasoning.steps.map((s) => `- ${s.description}: ${s.output}`).join("\n")}
`;
  }
}