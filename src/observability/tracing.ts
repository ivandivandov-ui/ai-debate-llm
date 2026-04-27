// No imports needed for these contracts here currently
import { logger } from "./logging";

export interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export class Tracer {
  private spans: Map<string, TraceSpan> = new Map();
  private maxSpans = 5000;

  startSpan(name: string, metadata?: Record<string, unknown>): string {
    // Evict old completed spans if at capacity
    if (this.spans.size >= this.maxSpans) {
      this.evictCompleted();
    }
    
    const id = `span-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.spans.set(id, {
      id,
      name,
      startTime: Date.now(),
      metadata,
    });
    return id;
  }

  endSpan(id: string): TraceSpan | undefined {
    const span = this.spans.get(id);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
    }
    return span;
  }

  getSpan(id: string): TraceSpan | undefined {
    return this.spans.get(id);
  }

  getAllSpans(): TraceSpan[] {
    return Array.from(this.spans.values());
  }

  clear(): void {
    this.spans.clear();
  }

  private evictCompleted(): void {
    const completed: string[] = [];
    for (const [id, span] of this.spans) {
      if (span.endTime) {
        completed.push(id);
      }
    }
    // Remove oldest completed spans (up to half)
    const toRemove = completed.slice(0, Math.max(1, Math.floor(completed.length / 2)));
    for (const id of toRemove) {
      this.spans.delete(id);
    }
  }
}

export const tracer = new Tracer();

export interface DebugConfig {
  enabled: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  includeTraces: boolean;
}

export class Debugger {
  private config: DebugConfig;
  private traces: TraceSpan[] = [];

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV !== "production",
      logLevel: "info",
      includeTraces: false,
      ...config,
    };
  }

  log(level: DebugConfig["logLevel"], message: string, data?: unknown): void {
    if (!this.config.enabled) return;

    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    if (levels[level] > levels[this.config.logLevel]) return;

    logger.log(level, message, data as Record<string, unknown>);
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  trace(name: string): () => void {
    if (!this.config.includeTraces) {
      return () => {};
    }

    const spanId = tracer.startSpan(name);
    return () => {
      const span = tracer.endSpan(spanId);
      if (span) {
        this.debug(`Trace: ${name}`, { duration: span.duration });
      }
    };
  }
}

export const debugger_ = new Debugger();