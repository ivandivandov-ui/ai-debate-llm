import type { PipelineState, PipelineStage } from "./contracts/state";
import type { DebateRequest } from "./contracts/request";
import type { DebateResult, Evidence } from "./contracts/result";
import type { SessionId } from "./contracts/message";
export { type DebateRequest, type DebateResult };
import { createInitialState } from "./contracts/state";
import { generateSessionId } from "../utils/ids";

import { InputStage } from "./pipeline/input";
import { DecomposeStage } from "./pipeline/decompose";
import { DispatchStage } from "./pipeline/dispatch";
import { CollectStage } from "./pipeline/collect";
import { VerifyStage } from "./pipeline/verify";
import { DecisionStage } from "./pipeline/decision";
import { FuseStage } from "./pipeline/fuse";
import { StoreStage } from "./pipeline/store";
import { OutputStage } from "./pipeline/output";
import { JudgeStage } from "./pipeline/judge";
import { HumanStage } from "./pipeline/human";
import { ProviderRouter } from "../providers/router/provider-router";
import { logger } from "../observability/logging";
import { EdgeResolver } from "./runtime/edge-resolver";

export interface EngineConfig {
  maxRounds: number;
  timeout: number;
  enableCheckpoints: boolean;
  sessionTTL: number;
}

type StageHandler = (state: PipelineState, signal?: AbortSignal) => Promise<PipelineState>;
type StateListener = (state: PipelineState) => void;

export class DebateEngine {
  private static cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private static instances = new Set<{ states: Map<string, PipelineState>; ttl: number }>();

  private config: EngineConfig;
  private stages: Map<PipelineStage, StageHandler>;
  private stageOrder: PipelineStage[] = [
    "input",
    "decompose",
    "dispatch",
    "collect",
    "verify",
    "decision",
    "fuse",
    "store",
    "output",
  ];
  private states: Map<string, PipelineState> = new Map();
  private activeRuns: Map<string, Promise<DebateResult>> = new Map();
  private providerRouter?: ProviderRouter;
  private resolver: EdgeResolver = new EdgeResolver();
  private stateListeners: Set<StateListener> = new Set();
  
  // Shared stage instances to allow access to their state/methods from edges
  private decisionStage = new DecisionStage();

  // Prevents router change after pipeline has started
  private _routerLocked = false;

  constructor(config?: Partial<EngineConfig>) {
    this.config = {
      maxRounds: 10,
      timeout: 300000,
      enableCheckpoints: false,
      sessionTTL: 3600000,
      ...config,
    };

    this.stages = new Map();
    this.registerStages();

    // Register this session map for global cleanup
    DebateEngine.instances.add({ states: this.states, ttl: this.config.sessionTTL });
    DebateEngine.startCleanupIfNeeded();
  }

  destroy(): void {
    // Remove from global cleanup
    for (const item of DebateEngine.instances) {
      if (item.states === this.states) {
        DebateEngine.instances.delete(item);
        break;
      }
    }
    
    if (DebateEngine.instances.size === 0 && DebateEngine.cleanupTimer) {
      clearInterval(DebateEngine.cleanupTimer);
      DebateEngine.cleanupTimer = null;
    }

    this.states.clear();
    this.activeRuns.clear();
    this.stateListeners.clear();
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private emitStateChange(state: PipelineState): void {
    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch (error) {
        logger.warn(`[Engine] State listener failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private static startCleanupIfNeeded(): void {
    if (!DebateEngine.cleanupTimer) {
      DebateEngine.cleanupTimer = setInterval(() => DebateEngine.cleanupAllSessions(), 300000);
      // Allow Node.js process to exit if only this timer remains
      if (DebateEngine.cleanupTimer && typeof DebateEngine.cleanupTimer === "object") {
        (DebateEngine.cleanupTimer as NodeJS.Timeout).unref?.();
      }
    }
  }

  private static async cleanupAllSessions(): Promise<void> {
    const now = Date.now();
    let totalCleaned = 0;

    // Cleanup rate limits in agents
    try {
      const { BaseAgent } = await import("../agents/base/base.agent");
      BaseAgent.cleanupRateLimits();
    } catch (e) {
      // Ignore if not yet loaded or error
    }

    for (const { states, ttl } of DebateEngine.instances) {
      let cleaned = 0;
      for (const [sessionId, state] of states) {
        const age = now - (state.updatedAt || state.createdAt || now);
        if (age > ttl) {
          states.delete(sessionId);
          cleaned++;
        }
      }
      totalCleaned += cleaned;
    }

    if (totalCleaned > 0) {
      logger.info(`[Engine] Cleaned up ${totalCleaned} old sessions across all instances`);
    }
  }

  setProviderRouter(router: ProviderRouter): void {
    if (this._routerLocked) {
      logger.warn("[Engine] Cannot change ProviderRouter after pipeline has started");
      return;
    }
    this.providerRouter = router;
    this.registerStages(); // Rebuild stages with new router
  }

  private registerStages(): void {
    const inputStage = new InputStage();
    const decomposeStage = new DecomposeStage();
    const dispatchStage = new DispatchStage();
    const collectStage = new CollectStage();
    const verifyStage = new VerifyStage();
    
    // Use the shared decision stage
    this.decisionStage = new DecisionStage({
      enableLoop: false,
      maxRounds: 1,
    });
    
    const fuseStage = new FuseStage();
    const judgeStage = new JudgeStage();
    const storeStage = new StoreStage();
    const outputStage = new OutputStage();
    const humanStage = new HumanStage();

    if (this.providerRouter) {
      collectStage.setProviderRouter(this.providerRouter);
    }

    this.stages.set("input", inputStage.execute.bind(inputStage));
    this.stages.set("decompose", decomposeStage.execute.bind(decomposeStage));
    this.stages.set("dispatch", dispatchStage.execute.bind(dispatchStage));
    this.stages.set("collect", collectStage.execute.bind(collectStage));
    this.stages.set("verify", verifyStage.execute.bind(verifyStage));
    this.stages.set("decision", this.decisionStage.execute.bind(this.decisionStage));
    this.stages.set("fuse", fuseStage.execute.bind(fuseStage));
    this.stages.set("judge", judgeStage.execute.bind(judgeStage));
    this.stages.set("store", storeStage.execute.bind(storeStage));
    this.stages.set("output", outputStage.execute.bind(outputStage));
    this.stages.set("human", humanStage.execute.bind(humanStage));

    // Register Graph Edges
    this.resolver.setEdges([
      { from: "decision", to: "dispatch", condition: (s) => this.decisionStage.shouldContinue(s) },
      { from: "decision", to: "human", condition: (s) => !this.decisionStage.shouldContinue(s) && s.request.preferences?.interactive === true },
      { from: "decision", to: "fuse", condition: (s) => !this.decisionStage.shouldContinue(s) && s.request.preferences?.interactive !== true },
      { from: "human", to: "fuse" }, // After human input, proceed to fuse
      { from: "fuse", to: "judge", condition: (s) => !!s.synthesis.final },
      { from: "fuse", to: "decision", condition: (s) => !s.synthesis.final && this.decisionStage.shouldContinue(s) },
      { from: "fuse", to: "store", condition: (s) => !s.synthesis.final && !this.decisionStage.shouldContinue(s) },
      { from: "judge", to: "store" },
    ]);
  }

  async run(request: DebateRequest, providedSessionId?: SessionId, signal?: AbortSignal): Promise<DebateResult> {
    // Basic request validation
    if (!request || !request.query || !request.id) {
      throw new Error("INVALID_REQUEST: Missing required fields (id, query)");
    }

    const sessionId = providedSessionId || (generateSessionId() as SessionId);

    // Guard against concurrent runs for the same session
    const existingRun = this.activeRuns.get(sessionId);
    if (existingRun) {
      // Return existing promise to make it idempotent
      return existingRun;
    }

    // Lock the router once the first pipeline starts
    this._routerLocked = true;
    
    const runPromise = this.executePipeline(request, sessionId, signal);
    this.activeRuns.set(sessionId, runPromise);

    try {
      const result = await runPromise;
      return result;
    } finally {
      this.activeRuns.delete(sessionId);
      
      const state = this.states.get(sessionId);
      // Delete state ONLY if it's complete AND checkpoints are disabled
      // If it's stopped (waiting for human), we MUST keep it
      if (state && state.isComplete && !this.config.enableCheckpoints) {
        this.states.delete(sessionId);
      }
    }
  }

  async resume(sessionId: SessionId, input?: string, signal?: AbortSignal): Promise<DebateResult> {
    const state = this.states.get(sessionId);
    if (!state) {
      throw new Error(`SESSION_NOT_FOUND: ${sessionId}`);
    }

    if (!state.stopped) {
      throw new Error(`SESSION_NOT_PAUSED: Session ${sessionId} is not in a paused state`);
    }

    // Apply human input
    state.humanInput = input;
    
    // Resume pipeline
    const runPromise = this.executePipeline(state.request, sessionId, signal, state);
    this.activeRuns.set(sessionId, runPromise);

    try {
      const result = await runPromise;
      return result;
    } finally {
      this.activeRuns.delete(sessionId);
      const updatedState = this.states.get(sessionId);
      if (updatedState && updatedState.isComplete && !this.config.enableCheckpoints) {
        this.states.delete(sessionId);
      }
    }
  }

  private async executePipeline(
    request: DebateRequest,
    sessionId: SessionId,
    externalSignal?: AbortSignal,
    initialState?: PipelineState
  ): Promise<DebateResult> {
    let state = initialState || createInitialState(request, sessionId);
    const startTime = Date.now();

    // Setup abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    // If external signal is provided, listen to it
    const onAbort = () => controller.abort();
    if (externalSignal) {
      externalSignal.addEventListener("abort", onAbort);
    }

    try {
      while (!state.isComplete) {
        if (controller.signal.aborted) {
          throw new Error("TIMEOUT: Pipeline execution exceeded timeout");
        }
        if (Date.now() - startTime > this.config.timeout) {
          controller.abort();
          throw new Error("TIMEOUT: Pipeline execution exceeded timeout");
        }

        if (state.round > this.config.maxRounds) {
          throw new Error("MAX_ROUNDS: Exceeded maximum rounds");
        }

        state = await this.executeStage(state, controller.signal);
        
        if (state.stopped) {
          this.states.set(sessionId, state);
          this.emitStateChange(state);
          // Return a dummy result or throw a specific error to indicate it's paused
          // For now, let's just return what we have so far
          return this.buildResult(state, startTime);
        }

        // Resolve next stage using the graph resolver
        const nextStage = this.resolver.resolve(state);
        if (nextStage === "END") {
          state.isComplete = true;
        } else {
          state.stage = nextStage;
        }

        this.states.set(sessionId, state);
        this.emitStateChange(state);
      }

      return this.buildResult(state, startTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      state = {
        ...state,
        error: errorMessage,
      };
      this.states.set(state.sessionId, state);
      this.emitStateChange(state);
      throw error; // rethrow to be caught by run()
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onAbort);
      }
      clearTimeout(timeoutId);
    }
  }

  private async executeStage(
    state: PipelineState,
    signal?: AbortSignal
  ): Promise<PipelineState> {
    const stage = state.stage;
    const handler = this.stages.get(stage);

    if (!handler) {
      throw new Error(`UNKNOWN_STAGE: No handler for stage ${stage}`);
    }

    return handler(state, signal);
  }

  private buildResult(state: PipelineState, startTime: number): DebateResult {
    // Safe access to synthesis and candidates
    const bestCandidate = state.synthesis?.candidates?.[0];
    const finalAnswer = bestCandidate?.content ?? "No result available";

    const totalTokens = state.results.reduce((sum, r) => sum + r.metrics.tokensUsed, 0);
    const totalCost = state.results.reduce((sum, r) => sum + r.metrics.cost, 0);
    const totalLatency = state.results.reduce((sum, r) => sum + r.metrics.latencyMs, 0);
    const providersUsed = [...new Set(state.results.map((r) => r.metrics.provider))];

    return {
      id: state.sessionId,
      requestId: state.request.id,
      query: state.request.query,
      finalAnswer,
      confidence: bestCandidate?.confidence ?? 0,
      evidence: this.collectEvidence(state),
      reasoning: {
        steps: state.history.map((h, i) => ({
          id: `step-${i}`,
          description: h.stage,
          agentId: h.agentId ?? "system",
          timestamp: h.timestamp,
          input: h.input,
          output: h.output,
          type: "synthesis" as const,
        })),
        conclusion: finalAnswer,
      },
      metrics: {
        totalTokens,
        totalCost,
        totalRounds: state.round,
        totalAgents: this.countUniqueAgents(state),
        executionTimeMs: Date.now() - startTime, // wall-clock time
        providersUsed,
      },
    };
  }

  getState(sessionId: string): PipelineState | undefined {
    return this.states.get(sessionId);
  }

  private countUniqueAgents(state: PipelineState): number {
    const agentIds = new Set<string>();
    for (const task of state.tasks) {
      if (task.assignedAgent) {
        agentIds.add(task.assignedAgent);
      }
    }
    for (const history of state.history) {
      if (history.agentId) {
        agentIds.add(history.agentId);
      }
    }
    return agentIds.size; // return 0 if none, previously returned 1 incorrectly
  }

  private collectEvidence(state: PipelineState): Evidence[] {
    const evidence: Evidence[] = [];

    for (const result of state.results) {
      if (!result.success || !result.output) continue;

      // Ensure we only work with string outputs to avoid [object Object]
      const content = typeof result.output === "string"
        ? result.output
        : JSON.stringify(result.output);

      if (content.length > 20) {
        evidence.push({
          id: result.taskId,
          content: content.substring(0, 200),
          relevance: 0.8,
          verificationStatus: "verified",
        });
      }
    }

    return evidence;
  }
}

export function createEngine(config?: Partial<EngineConfig>): DebateEngine {
  return new DebateEngine(config);
}
