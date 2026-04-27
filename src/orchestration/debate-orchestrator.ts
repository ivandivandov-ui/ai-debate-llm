import type { SessionId } from "../core/contracts/message";
import type { DebateRequest } from "../core/contracts/request";
import type { DebateResult } from "../core/contracts/result";
import type { PipelineState } from "../core/contracts/state";

import { DebateEngine } from "../core/engine";
import { ProviderRouter } from "../providers/router/provider-router";
import { generateSessionId } from "../utils/ids";
import { logger } from "../observability/logging";

export interface DebateOrchestratorConfig {
  maxConcurrentSessions: number;
  sessionTimeout: number;
  enableCostTracking: boolean;
  sessionTTL: number;
  maxRounds: number;
  debateTimeoutMs: number;
}

export class DebateOrchestrator {
  private engine: DebateEngine;
  private config: DebateOrchestratorConfig;
  private sessions: Map<SessionId, SessionInfo> = new Map();
  private states: Map<SessionId, PipelineState> = new Map();
  private cleanupInterval?: ReturnType<typeof setInterval>;
  private abortControllers: Map<SessionId, AbortController> = new Map();

  constructor(config?: Partial<DebateOrchestratorConfig>) {
    this.config = {
      maxConcurrentSessions: 100,
      sessionTimeout: 300000,
      enableCostTracking: true,
      sessionTTL: 3600000, // 1 hour default
      maxRounds: 1,
      debateTimeoutMs: 600000, // 10 minutes
      ...config,
    };
    this.engine = new DebateEngine({
      enableCheckpoints: true,
      maxRounds: this.config.maxRounds,
      timeout: this.config.debateTimeoutMs,
    });
    
    // Periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanupOldSessions(), 300000);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.sessions.clear();
    this.states.clear();
    this.engine.destroy();
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    let cleaned = 0;
    const sessionsToRemove: SessionId[] = [];
    
    for (const [sessionId, info] of this.sessions) {
      const age = now - info.startTime;
      if (age > this.config.sessionTTL) {
        sessionsToRemove.push(sessionId);
      }
    }
    
    for (const sessionId of sessionsToRemove) {
      this.sessions.delete(sessionId);
      this.states.delete(sessionId);
      cleaned++;
    }
    
    if (cleaned > 0) {
      logger.debug(`[Orchestrator] Cleaned up ${cleaned} old sessions`);
    }
  }

  setProviderRouter(router: ProviderRouter): void {
    this.engine.setProviderRouter(router);
  }

  async run(request: DebateRequest): Promise<DebateResult> {
    const sessionId = ((request.metadata?.sessionId as SessionId | undefined) ||
      (request.id as SessionId | undefined) ||
      (generateSessionId() as SessionId));

    if (this.sessions.size >= this.config.maxConcurrentSessions) {
      throw new Error("MAX_SESSIONS_REACHED");
    }

    const info: SessionInfo = {
      sessionId,
      request,
      startTime: Date.now(),
      status: "running",
    };
    this.sessions.set(sessionId, info);

    const controller = new AbortController();
    this.abortControllers.set(sessionId, controller);

    try {
      const result = await this.engine.run(request, sessionId, controller.signal);
      info.status = "completed";
      info.endTime = Date.now();
      
      // Save final state with same sessionId
      const state = this.engine.getState(sessionId);
      if (state) {
        this.states.set(sessionId, state);
      }
      
      return result;
    } catch (error) {
      info.status = "failed";
      info.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.abortControllers.delete(sessionId);
    }
  }

  async resume(sessionId: SessionId, input?: string): Promise<DebateResult> {
    const info = this.sessions.get(sessionId);
    if (!info) {
      throw new Error(`SESSION_NOT_FOUND: ${sessionId}`);
    }

    const controller = new AbortController();
    this.abortControllers.set(sessionId, controller);

    try {
      info.status = "running";
      const result = await this.engine.resume(sessionId, input, controller.signal);
      info.status = "completed";
      info.endTime = Date.now();
      return result;
    } catch (error) {
      info.status = "failed";
      info.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.abortControllers.delete(sessionId);
    }
  }

  getSession(sessionId: SessionId): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  getSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  abort(sessionId: SessionId): boolean {
    const info = this.sessions.get(sessionId);
    const controller = this.abortControllers.get(sessionId);
    
    if (!info && !controller) return false;

    if (info) {
      info.status = "aborted";
      info.endTime = Date.now();
    }
    
    if (controller) {
      controller.abort();
      this.abortControllers.delete(sessionId);
    }
    
    this.cleanup(sessionId);
    return true;
  }

  getState(sessionId: SessionId): PipelineState | undefined {
    return this.states.get(sessionId);
  }

  onStateChange(listener: (state: PipelineState) => void): () => void {
    return this.engine.onStateChange((state) => {
      this.states.set(state.sessionId as SessionId, state);
      listener(state);
    });
  }

  private cleanup(sessionId: SessionId): void {
    this.sessions.delete(sessionId);
    this.states.delete(sessionId);
  }

  clearCompleted(): void {
    const now = Date.now();
    for (const [id, info] of this.sessions) {
      if (info.status !== "running") {
        if (now - info.startTime > this.config.sessionTimeout) {
          this.cleanup(id);
        }
      }
    }
  }
}

interface SessionInfo {
  sessionId: SessionId;
  request: DebateRequest;
  startTime: number;
  endTime?: number;
  status: "running" | "completed" | "failed" | "aborted";
  error?: string;
}
