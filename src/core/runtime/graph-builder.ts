import type { PipelineState, PipelineStage } from "../contracts/state";
import type { DebateRequest } from "../contracts/request";
import type { NodeConfig } from "./node-registry";

export interface GraphEdge {
  from: PipelineStage;
  to: PipelineStage | "END";
  condition?: (state: PipelineState) => boolean;
}

export interface GraphCheckpoint {
  id: string;
  state: PipelineState;
  stage: PipelineStage;
  createdAt: number;
}

export interface GraphConfig {
  checkpointer?: Checkpointer;
  interruptBefore?: PipelineStage[];
  interruptAfter?: PipelineStage[];
}

interface Checkpointer {
  get(checkpointId: string): Promise<PipelineState | null>;
  put(checkpointId: string, state: PipelineState): Promise<void>;
}

export class GraphBuilder {
  private nodes: Map<PipelineStage, NodeConfig> = new Map();
  private edges: GraphEdge[] = [];
  private config: GraphConfig = {};

  addNode(stage: PipelineStage, handler: NodeConfig): this {
    this.nodes.set(stage, handler);
    return this;
  }

  addEdge(from: PipelineStage, to: PipelineStage | "END", condition?: (state: PipelineState) => boolean): this {
    this.edges.push({ from, to, condition });
    return this;
  }

  setConfig(config: GraphConfig): this {
    this.config = config;
    return this;
  }

  build(): GraphDefinition {
    return {
      nodes: new Map(this.nodes),
      edges: [...this.edges],
      config: this.config,
    };
  }
}

export interface GraphDefinition {
  nodes: Map<PipelineStage, NodeConfig>;
  edges: GraphEdge[];
  config: GraphConfig;
}

export function createGraphBuilder(): GraphBuilder {
  return new GraphBuilder();
}