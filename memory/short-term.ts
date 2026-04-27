import type { PipelineState } from "../../core/contracts/state";

export interface MemoryEntry {
  sessionId: string;
  key: string;
  value: unknown;
  timestamp: number;
  ttl?: number;
}

export interface ShortTermMemory {
  get(sessionId: string, key: string): unknown | null;
  set(sessionId: string, key: string, value: unknown, ttl?: number): void;
  delete(sessionId: string, key: string): void;
  clear(sessionId: string): void;
  keys(sessionId: string): string[];
}

class InMemoryStore {
  private store = new Map<string, Map<string, MemoryEntry>>();

  get(sessionId: string, key: string): unknown | null {
    const session = this.store.get(sessionId);
    if (!session) return null;

    const entry = session.get(key);
    if (!entry) return null;

    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      session.delete(key);
      return null;
    }

    return entry.value;
  }

  set(sessionId: string, key: string, value: unknown, ttl?: number): void {
    if (!this.store.has(sessionId)) {
      this.store.set(sessionId, new Map());
    }

    this.store.get(sessionId)!.set(key, {
      sessionId,
      key,
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  delete(sessionId: string, key: string): void {
    this.store.get(sessionId)?.delete(key);
  }

  clear(sessionId: string): void {
    if (sessionId) {
      this.store.delete(sessionId);
    } else {
      this.store.clear();
    }
  }

  keys(sessionId: string): string[] {
    return Array.from(this.store.get(sessionId)?.keys() ?? []);
  }
}

export const shortTermMemory = new InMemoryStore();

export function getSessionMemory(sessionId: string): Partial<PipelineState> | null {
  return shortTermMemory.get(sessionId, "state") as Partial<PipelineState> | null;
}

export function setSessionMemory(sessionId: string, state: Partial<PipelineState>): void {
  shortTermMemory.set(sessionId, "state", state);
}