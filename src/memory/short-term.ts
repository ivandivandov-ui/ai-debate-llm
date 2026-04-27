export interface MemoryEntry {
  key: string;
  value: unknown;
  timestamp: number;
  ttl?: number;
}

export interface MemoryStore {
  get(key: string): unknown | null;
  set(key: string, value: unknown, ttl?: number): void;
  delete(key: string): boolean;
  clear(): void;
  keys(): string[];
}

class ShortTermMemoryStore implements MemoryStore {
  private store = new Map<string, MemoryEntry>();
  private defaultTTL = 300000;
  private maxEntries = 5000;

  get(key: string): unknown | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: unknown, ttl = this.defaultTTL): void {
    // Evict expired + oldest if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evict();
    }
    
    this.store.set(key, {
      key,
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  private evict(): void {
    const now = Date.now();
    // First, remove expired entries
    for (const [k, entry] of this.store) {
      if (entry.ttl && now > entry.timestamp + entry.ttl) {
        this.store.delete(k);
      }
    }
    // If still over limit, remove oldest entries
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
  }
}

export const shortTermMemory = new ShortTermMemoryStore();

export function getSessionMemory(sessionId: string): unknown | null {
  return shortTermMemory.get(`session:${sessionId}`);
}

export function setSessionMemory(sessionId: string, value: unknown, ttl?: number): void {
  shortTermMemory.set(`session:${sessionId}`, value, ttl);
}

