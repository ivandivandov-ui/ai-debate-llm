import type { PipelineState, PipelineStage, HistoryEntry } from "../contracts/state";
import type { GraphEdge } from "./graph-builder";

export interface EdgeResolverConfig {
  handleInterrupt: boolean;
  handleError: boolean;
}

export class EdgeResolver {
  private edges: GraphEdge[] = [];
  private config: EdgeResolverConfig;

  constructor(config?: Partial<EdgeResolverConfig>) {
    this.config = {
      handleInterrupt: true,
      handleError: true,
      ...config,
    };
  }

  setEdges(edges: GraphEdge[]): void {
    this.edges = edges;
  }

  resolve(state: PipelineState): PipelineStage | "END" {
    if (state.isComplete) {
      return "END";
    }

    if (state.error && this.config.handleError) {
      return "END";
    }

    // 1. Try explicit graph edges
    const applicableEdges = this.edges.filter((edge) => edge.from === state.stage);

    for (const edge of applicableEdges) {
      if (!edge.condition || edge.condition(state)) {
        return edge.to;
      }
    }

    // 2. Fallback to default linear progression
    return this.getNextStage(state.stage);
  }

  private getNextStage(current: PipelineStage): PipelineStage | "END" {
    const order: (PipelineStage | "END")[] = [
      "input",
      "decompose",
      "dispatch",
      "collect",
      "verify",
      "decision",
      "fuse",
      "judge",
      "store",
      "output",
      "END"
    ];

    const idx = order.indexOf(current);
    if (idx >= 0 && idx < order.length - 1) {
      return order[idx + 1] as PipelineStage | "END";
    }

    return "END";
  }

  shouldCheckpoint(state: PipelineState): boolean {
    if (state.stage === "decision") return true;
    if (state.stage === "fuse") return true;
    if (state.round > 0 && state.round % 5 === 0) return true;
    return false;
  }
}

export function createEdgeResolver(config?: Partial<EdgeResolverConfig>): EdgeResolver {
  return new EdgeResolver(config);
}