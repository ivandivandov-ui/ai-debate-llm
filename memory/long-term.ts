export interface MemoryEntry {
  id: string;
  sessionId: string;
  type: "fact" | "preference" | "context";
  content: string;
  embedding?: number[];
  importance: number;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
}

export interface LongTermMemory {
  store(entry: MemoryEntry): Promise<void>;
  retrieve(query: string, limit?: number): Promise<MemoryEntry[]>;
  delete(id: string): Promise<void>;
  update(id: string, updates: Partial<MemoryEntry>): Promise<void>;
}

class InMemoryLongTerm implements LongTermMemory {
  private store = new Map<string, MemoryEntry>();

  async store(entry: MemoryEntry): Promise<void> {
    this.store.set(entry.id, entry);
  }

  async retrieve(_query: string, limit = 10): Promise<MemoryEntry[]> {
    return Array.from(this.store.values()).slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    const existing = this.store.get(id);
    if (existing) {
      this.store.set(id, { ...existing, ...updates });
    }
  }
}

export const longTermMemory = new InMemoryLongTerm();