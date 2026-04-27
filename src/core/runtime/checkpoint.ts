import type { PipelineState } from "../contracts/state";

export interface CheckpointConfig {
  storage: CheckpointStorage;
  maxCheckpoints: number;
  interval: number;
}

export interface CheckpointData {
  id: string;
  sessionId: string;
  state: PipelineState;
  round: number;
  stage: string;
  createdAt: number;
}

interface CheckpointStorage {
  save(checkpoint: CheckpointData): Promise<void>;
  load(id: string): Promise<CheckpointData | null>;
  list(sessionId: string): Promise<CheckpointData[]>;
  delete(id: string): Promise<void>;
  clear(sessionId?: string): Promise<void>;
}

class InMemoryStorage implements CheckpointStorage {
  private store = new Map<string, CheckpointData>();

  async save(checkpoint: CheckpointData): Promise<void> {
    this.store.set(checkpoint.id, checkpoint);
  }

  async load(id: string): Promise<CheckpointData | null> {
    return this.store.get(id) ?? null;
  }

  async list(sessionId: string): Promise<CheckpointData[]> {
    return Array.from(this.store.values()).filter((c) => c.sessionId === sessionId);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async clear(_sessionId?: string): Promise<void> {
    this.store.clear();
  }
}

export class CheckpointManager {
  private storage: CheckpointStorage;
  private config: CheckpointConfig;

  constructor(config?: Partial<CheckpointConfig>) {
    this.config = {
      storage: new InMemoryStorage(),
      maxCheckpoints: 100,
      interval: 1,
      ...config,
    };
    this.storage = this.config.storage;
  }

  async save(sessionId: string, state: PipelineState): Promise<string> {
    const checkpointId = `checkpoint-${state.round}-${Date.now()}`;
    const checkpoint: CheckpointData = {
      id: checkpointId,
      sessionId,
      state,
      round: state.round,
      stage: state.stage,
      createdAt: Date.now(),
    };

    await this.storage.save(checkpoint);

    await this.cleanupOldCheckpoints(sessionId);

    return checkpointId;
  }

  async load(checkpointId: string): Promise<PipelineState | null> {
    const checkpoint = await this.storage.load(checkpointId);
    return checkpoint?.state ?? null;
  }

  async list(sessionId: string): Promise<CheckpointData[]> {
    return this.storage.list(sessionId);
  }

  async getLatest(sessionId: string): Promise<PipelineState | null> {
    const checkpoints = await this.storage.list(sessionId);
    if (checkpoints.length === 0) return null;

    checkpoints.sort((a, b) => b.createdAt - a.createdAt);
    return checkpoints[0].state;
  }

  private async cleanupOldCheckpoints(sessionId: string): Promise<void> {
    const checkpoints = await this.storage.list(sessionId);
    if (checkpoints.length <= this.config.maxCheckpoints) return;

    checkpoints.sort((a, b) => a.createdAt - b.createdAt);
    const toDelete = checkpoints.slice(0, checkpoints.length - this.config.maxCheckpoints);

    for (const checkpoint of toDelete) {
      await this.storage.delete(checkpoint.id);
    }
  }
}

export function createCheckpointManager(config?: Partial<CheckpointConfig>): CheckpointManager {
  return new CheckpointManager(config);
}