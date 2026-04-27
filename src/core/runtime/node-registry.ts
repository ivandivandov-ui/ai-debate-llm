import type { PipelineState, PipelineStage } from "../contracts/state";

export interface NodeConfig {
  name: PipelineStage;
  handler: (state: PipelineState) => Promise<PipelineState>;
  retry?: number;
  timeout?: number;
}

export interface NodeMetadata {
  name: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export class NodeRegistry {
  private nodes: Map<PipelineStage, NodeConfig> = new Map();
  private metadata: Map<string, NodeMetadata> = new Map();

  register(config: NodeConfig): void {
    this.nodes.set(config.name, config);
    this.metadata.set(config.name, {
      name: config.name,
    });
  }

  get(stage: PipelineStage): NodeConfig | undefined {
    return this.nodes.get(stage);
  }

  getHandler(stage: PipelineStage): ((state: PipelineState) => Promise<PipelineState>) | undefined {
    return this.nodes.get(stage)?.handler;
  }

  getAllStages(): PipelineStage[] {
    return Array.from(this.nodes.keys());
  }

  has(stage: PipelineStage): boolean {
    return this.nodes.has(stage);
  }

  getMetadata(stage: PipelineStage): NodeMetadata | undefined {
    return this.metadata.get(stage);
  }

  clear(): void {
    this.nodes.clear();
    this.metadata.clear();
  }
}

export function createNode(name: PipelineStage, handler: NodeConfig["handler"]): NodeConfig {
  return { name, handler };
}

export async function executeWithRetry(
  handler: (state: PipelineState) => Promise<PipelineState>,
  retries: number,
  state: PipelineState
): Promise<PipelineState> {
  let lastError: Error | undefined;
  let currentState = state;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      currentState = await handler(currentState);
      return currentState;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError;
}