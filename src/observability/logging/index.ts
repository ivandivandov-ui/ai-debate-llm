export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface LoggerConfig {
  maxLogEntries: number;
  logTTL: number;
}

class Logger {
  private logs: LogEntry[] = [];
  private listeners: Set<(entry: LogEntry) => void> = new Set();
  private config: LoggerConfig = {
    maxLogEntries: 10000,
    logTTL: 3600000, // 1 hour
  };
  private callsSinceCleanup = 0;
  private cleanupInterval = 100;

  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  log(level: LogEntry["level"], message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
    };
    this.logs.push(entry);
    
    // Only cleanup periodically, not on every call
    this.callsSinceCleanup++;
    if (this.callsSinceCleanup >= this.cleanupInterval || this.logs.length > this.config.maxLogEntries * 1.1) {
      this.cleanup();
      this.callsSinceCleanup = 0;
    }
    
    this.listeners.forEach((listener) => listener(entry));
    
    // Default console output
    if (process.env.NODE_ENV !== "test") {
      const color = level === "error" ? "\x1b[31m" : level === "warn" ? "\x1b[33m" : level === "debug" ? "\x1b[90m" : "\x1b[36m";
      const reset = "\x1b[0m";
      const ctxStr = context ? ` ${JSON.stringify(context)}` : "";
      console.log(`${color}[${level.toUpperCase()}]${reset} ${message}${ctxStr}`);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    // Remove old logs based on TTL
    this.logs = this.logs.filter((log) => now - log.timestamp < this.config.logTTL);
    // Also limit by max entries
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.logs = [];
  }
}

export const logger = new Logger();