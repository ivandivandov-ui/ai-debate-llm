import type { MemoryEntry } from "./short-term";
import { promises as fs } from "fs";
import * as path from "path";
import { logger } from "../observability/logging";

export interface LongTermMemoryConfig {
  maxEntries: number;
  persistToDisk: boolean;
  storagePath: string;
}

class LongTermMemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private config: LongTermMemoryConfig;
  private isLoaded: boolean = false;

  constructor(config?: Partial<LongTermMemoryConfig>) {
    this.config = {
      maxEntries: 10000,
      persistToDisk: false,
      storagePath: "./data/memory.json",
      ...config,
    };
  }

  private async loadFromDisk(): Promise<void> {
    if (this.isLoaded || !this.config.persistToDisk) return;
    
    try {
      await fs.mkdir(path.dirname(this.config.storagePath), { recursive: true });
      try {
        const data = await fs.readFile(this.config.storagePath, "utf-8");
        const parsed: MemoryEntry[] = JSON.parse(data);
        for (const entry of parsed) {
          this.entries.set(entry.key, entry);
        }
        logger.debug(`[LongTermMemory] Loaded ${this.entries.size} entries from disk`);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          logger.error("[LongTermMemory] Failed to load memory from disk", { error: err.message });
        }
      }
    } catch (err: any) {
      logger.error("[LongTermMemory] Failed to create directory for memory", { error: err.message });
    }
    this.isLoaded = true;
  }

  private async saveToDisk(): Promise<void> {
    if (!this.config.persistToDisk) return;
    try {
      await fs.mkdir(path.dirname(this.config.storagePath), { recursive: true });
      const data = Array.from(this.entries.values());
      await fs.writeFile(this.config.storagePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err: any) {
      logger.error("[LongTermMemory] Failed to save memory to disk", { error: err.message });
    }
  }

  async store(key: string, value: unknown): Promise<void> {
    await this.loadFromDisk();

    if (this.entries.size >= this.config.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest) this.entries.delete(oldest);
    }

    this.entries.set(key, {
      key,
      value,
      timestamp: Date.now(),
    });

    await this.saveToDisk();
  }

  async retrieve(key: string): Promise<unknown | null> {
    await this.loadFromDisk();
    return this.entries.get(key)?.value ?? null;
  }

  async search(query: string): Promise<MemoryEntry[]> {
    await this.loadFromDisk();
    const results: MemoryEntry[] = [];
    const lowerQuery = query.toLowerCase();

    for (const entry of this.entries.values()) {
      const valueStr = JSON.stringify(entry.value).toLowerCase();
      if (valueStr.includes(lowerQuery)) {
        results.push(entry);
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    await this.saveToDisk();
  }

  get size(): number {
    return this.entries.size;
  }
}

export const longTermMemory = new LongTermMemoryStore();