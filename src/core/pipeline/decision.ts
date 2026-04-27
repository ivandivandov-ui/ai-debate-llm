import type { PipelineState, PipelineStage } from "../contracts/state";

export interface UncertaintyScore {
  value: number;
  sources: UncertaintySource[];
  breakdown: Record<string, number>;
}

export type UncertaintySource = 
  | "conflicting_evidence"
  | "insufficient_data"
  | "logical_gaps"
  | "unverified_assumptions"
  | "model_uncertainty"
  | "edge_case_unknown";

export interface DecisionMetrics {
  roundsWithoutProgress: number;
  lastSignificantChange: number;
  convergenceTrend: number[];
  contradictionDepth: number;
  verificationCoherence: number;
}

export interface StopCondition {
  type: "max_rounds" | "convergence" | "saturation" | "contradiction" | "uncertainty" | "no_answer";
  reason: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface DecisionStageConfig {
  maxRounds: number;
  minVerificationRate: number;
  enableLoop: boolean;
  convergenceThreshold: number;
  uncertaintyThreshold: number;
  roundsWithoutProgressLimit: number;
  enableUncertaintyTracking: boolean;
  enableContradictionDetection: boolean;
}

export class DecisionStage {
  private config: DecisionStageConfig;
  private metrics: Map<string, DecisionMetrics> = new Map();
  private maxSessionsToTrack = 1000;

  constructor(config?: Partial<DecisionStageConfig>) {
    this.config = {
      maxRounds: 10,
      minVerificationRate: 0.7,
      enableLoop: true,
      convergenceThreshold: 0.9,
      uncertaintyThreshold: 0.6,
      roundsWithoutProgressLimit: 3,
      enableUncertaintyTracking: true,
      enableContradictionDetection: true,
      ...config,
    };
  }

  clear(): void {
    this.metrics.clear();
  }

  private getOrCreateMetrics(sessionId: string): DecisionMetrics {
    // Cleanup old sessions if we have too many
    if (this.metrics.size >= this.maxSessionsToTrack) {
      this.cleanupOldSessions();
    }
    
    let sessionMetrics = this.metrics.get(sessionId);
    if (!sessionMetrics) {
      sessionMetrics = {
        roundsWithoutProgress: 0,
        lastSignificantChange: 0,
        convergenceTrend: [],
        contradictionDepth: 0,
        verificationCoherence: 0,
      };
      this.metrics.set(sessionId, sessionMetrics);
    }
    return sessionMetrics;
  }

  private cleanupOldSessions(): void {
    const sessionsToRemove: string[] = [];
    let count = 0;
    for (const [sessionId] of this.metrics) {
      sessionsToRemove.push(sessionId);
      count++;
      if (count >= 50) break;
    }
    for (const sessionId of sessionsToRemove) {
      this.metrics.delete(sessionId);
    }
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    if (signal?.aborted) throw new Error("ABORTED");
    const sessionMetrics = this.getOrCreateMetrics(state.sessionId);
    
    // Check if we have a protocol-specific stop condition
    const { GlobalRegistry } = await import("../global-registry");
    const protocol = GlobalRegistry.getInstance().getProtocols().get(state.protocol);

    if (protocol && !protocol.shouldContinue({
      round: state.round,
      phase: state.stage as any,
      history: [],
      proposals: [],
      positions: new Map(),
    })) {
      return this.handleStop(state, { type: "max_rounds", reason: "Protocol requested stop", confidence: 1 }, sessionMetrics);
    }

    const stopCondition = this.evaluateStopConditions(state, sessionMetrics);
    if (stopCondition) {
      return this.handleStop(state, stopCondition, sessionMetrics);
    }

    if (this.shouldContinue(state)) {
      return this.continueDebate(state, sessionMetrics);
    }

    return this.transitionTo(state);
  }

  private evaluateStopConditions(state: PipelineState, metrics: DecisionMetrics): StopCondition | null {
    const conditions: (StopCondition | null)[] = [];

    conditions.push(this.checkMaxRounds(state));
    conditions.push(this.checkConvergence(state));
    conditions.push(this.checkSaturation(state, metrics));
    conditions.push(this.checkContradiction(state, metrics));

    if (this.config.enableUncertaintyTracking) {
      conditions.push(this.checkUncertainty(state));
    }

    for (const condition of conditions) {
      if (condition) {
        return condition;
      }
    }

    return null;
  }

  private checkMaxRounds(state: PipelineState): StopCondition | null {
    if (state.round >= this.config.maxRounds) {
      return {
        type: "max_rounds",
        reason: `Reached maximum rounds (${this.config.maxRounds})`,
        confidence: 0.5,
      };
    }
    return null;
  }

  private checkConvergence(state: PipelineState): StopCondition | null {
    const total = state.verification.pending.length + 
                 state.verification.verified.length + 
                 state.verification.failed.length;
    
    if (total === 0) return null;

    const verificationRate = state.verification.verified.length / total;

    if (verificationRate >= this.config.convergenceThreshold) {
      return {
        type: "convergence",
        reason: `Verification converged (${(verificationRate * 100).toFixed(1)}% verified)`,
        confidence: verificationRate,
        metadata: { verificationRate },
      };
    }
    return null;
  }

  private checkSaturation(state: PipelineState, metrics: DecisionMetrics): StopCondition | null {
    const recentHistory = state.history.slice(-10);
    
    if (recentHistory.length < 5) return null;

    const outputs = recentHistory.map(h => h.output);
    const uniqueOutputs = new Set(outputs);
    
    if (uniqueOutputs.size === 1 && state.round > 2) {
      metrics.roundsWithoutProgress++;
      
      if (metrics.roundsWithoutProgress >= this.config.roundsWithoutProgressLimit) {
        return {
          type: "saturation",
          reason: `No new arguments in ${metrics.roundsWithoutProgress} rounds (stuck)`,
          confidence: 0.8,
          metadata: { roundsWithoutProgress: metrics.roundsWithoutProgress },
        };
      }
    } else {
      metrics.roundsWithoutProgress = 0;
      metrics.lastSignificantChange = Date.now();
    }

    return null;
  }

  private checkContradiction(state: PipelineState, metrics: DecisionMetrics): StopCondition | null {
    if (!this.config.enableContradictionDetection) return null;

    const candidates = state.synthesis.candidates;
    if (candidates.length < 2) return null;

    const contradictions = this.detectContradictions(candidates);
    metrics.contradictionDepth = contradictions.length;

    const failRate = state.verification.failed.length /
      (state.verification.verified.length + state.verification.failed.length + 1);

    if (contradictions.length >= 2 && failRate > 0.5) {
      return {
        type: "contradiction",
        reason: `Deep contradiction detected (${contradictions.length} conflicts)`,
        confidence: 0.7,
        metadata: { contradictions },
      };
    }

    return null;
  }

  private checkUncertainty(state: PipelineState): StopCondition | null {
    const uncertainty = this.calculateUncertainty(state);
    
    if (uncertainty.value > this.config.uncertaintyThreshold) {
      return {
        type: "uncertainty",
        reason: `High uncertainty (${(uncertainty.value * 100).toFixed(1)}%)`,
        confidence: 1 - uncertainty.value,
        metadata: { uncertainty: uncertainty.breakdown },
      };
    }

    return null;
  }

  private calculateUncertainty(state: PipelineState): UncertaintyScore {
    const sources: UncertaintySource[] = [];
    const breakdown: Record<string, number> = {};

    const verifiedRate = state.verification.verified.length /
      (state.verification.verified.length + state.verification.failed.length + 1);
    const failedRate = state.verification.failed.length /
      (state.verification.verified.length + state.verification.failed.length + 1);

    breakdown["verification_failure"] = failedRate;

    if (failedRate > 0.3) {
      sources.push("unverified_assumptions");
      breakdown["unverified_assumptions"] = failedRate;
    }

    const results = state.results.filter(r => !r.success);
    if (results.length > state.results.length * 0.3) {
      sources.push("insufficient_data");
      breakdown["insufficient_data"] = results.length / state.results.length;
    }

    const candidates = state.synthesis.candidates;
    if (candidates.length > 3) {
      const avgConfidence = candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length;
      if (avgConfidence < 0.5) {
        sources.push("model_uncertainty");
        breakdown["model_uncertainty"] = 1 - avgConfidence;
      }
    }

    if (sources.length === 0) {
      sources.push("conflicting_evidence");
      breakdown["conflicting_evidence"] = 0;
    }

    const totalUncertainty = Object.values(breakdown).reduce((sum, v) => sum + v, 0) / Math.max(1, Object.keys(breakdown).length);

    return {
      value: Math.min(1, totalUncertainty),
      sources,
      breakdown,
    };
  }

  private detectContradictions(candidates: { content: string; id: string }[]): string[] {
    const contradictions: string[] = [];

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i].content.toLowerCase();
        const b = candidates[j].content.toLowerCase();

        if (this.isContradictory(a, b)) {
          contradictions.push(`${candidates[i].id} ↔ ${candidates[j].id}`);
        }
      }
    }

    return contradictions;
  }

  private isContradictory(a: string, b: string): boolean {
    const positive = ["yes", "true", "correct", "good", "should", "can"];
    const negative = ["no", "false", "incorrect", "bad", "should not", "cannot"];

    const aPositive = positive.some(w => a.includes(w));
    const bNegative = negative.some(w => b.includes(w));
    if (aPositive && bNegative) return true;

    const bPositive = positive.some(w => b.includes(w));
    const aNegative = negative.some(w => a.includes(w));
    if (bPositive && aNegative) return true;

    if (a.startsWith("always") && b.startsWith("never")) return true;
    if (a.startsWith("never") && b.startsWith("always")) return true;

    return false;
  }

  public shouldContinue(state: PipelineState): boolean {
    const metrics = this.getOrCreateMetrics(state.sessionId);
    if (state.error) return false;
    if (state.round >= this.config.maxRounds) return false;
    if (!this.config.enableLoop) return false;

    const failRate = state.verification.failed.length /
      (state.verification.verified.length + state.verification.failed.length + 1);

    if (failRate > 0.8) return false;
    if (metrics.roundsWithoutProgress >= this.config.roundsWithoutProgressLimit) return false;

    return true;
  }

  private handleStop(state: PipelineState, condition: StopCondition, metrics: DecisionMetrics): PipelineState {
    let nextStage: PipelineStage = "fuse";
    let output = condition.reason;

    if (condition.type === "contradiction") {
      nextStage = "output";
      output = `NO_CONSENSUS: ${condition.reason}`;
    }

    if (condition.type === "no_answer") {
      output = "INSUFFICIENT_EVIDENCE";
    }

    return {
      ...state,
      history: [
        ...state.history,
        {
          stage: "decision",
          timestamp: Date.now(),
          input: `round: ${state.round}, condition: ${condition.type}`,
          output,
        },
      ],
      updatedAt: Date.now(),
    };
  }

  private async continueDebate(state: PipelineState, metrics: DecisionMetrics): Promise<PipelineState> {
    // Generate new tasks based on previous round results
    let newTasks = [...state.tasks];
    
    const { GlobalRegistry } = await import("../global-registry");
    const protocol = GlobalRegistry.getInstance().getProtocols().get(state.protocol);
    let protocolSuggestion = "";

    if (protocol) {
      const decision = protocol.getNextTurn({
        round: state.round,
        phase: state.stage as any,
        history: [],
        proposals: [],
        positions: new Map(),
      });
      
      if (decision.suggestedAction) {
        protocolSuggestion = `Protocol suggests: ${decision.suggestedAction}`;
        // Add a specific task for the suggested action if it's not already covered
        if (decision.requiredRoles && decision.requiredRoles.length > 0) {
          newTasks.push({
            id: `protocol-${state.round}-${Date.now()}`,
            type: decision.suggestedAction as any,
            description: `Protocol-required action: ${decision.suggestedAction}`,
            input: state.request.query,
            assignedAgent: decision.requiredRoles[0],
          });
        }
      }
    }
    
    // Add rebuttal tasks for failed verifications
    if (state.verification.failed.length > 0) {
      const failedTasks = state.verification.failed.map((v, i) => ({
        id: `rebuttal-${state.round}-${i}`,
        type: "critique" as const,
        description: `Address verification failure: ${v.errors?.join(", ") || v.type}`,
        input: v.content,
        assignedAgent: "critic",
      }));
      newTasks = [...newTasks, ...failedTasks];
    }
    
    // Add refine tasks for low confidence results
    const lowConfidenceResults = state.results.filter((r, i) => r.success && r.output && 
      String(r.output).length > 50 && i % 3 === 0); // Deterministic sampling by index
    
    if (lowConfidenceResults.length > 0) {
      const refineTasks = lowConfidenceResults.slice(0, 2).map((r, i) => ({
        id: `refine-${state.round}-${i}`,
        type: "refine" as const,
        description: `Refine and improve this result`,
        input: r.output,
        assignedAgent: "skeptic",
      }));
      newTasks = [...newTasks, ...refineTasks];
    }
    
    return {
      ...state,
      round: state.round + 1,
      tasks: newTasks,
      history: [
        ...state.history,
        {
          stage: "decision",
          timestamp: Date.now(),
          input: `round: ${state.round}`,
          output: `continue with ${newTasks.length} tasks. ${protocolSuggestion}`,
        },
      ],
      updatedAt: Date.now(),
    };
  }

  private transitionTo(state: PipelineState): PipelineState {
    return {
      ...state,
      history: [
        ...state.history,
        {
          stage: "decision",
          timestamp: Date.now(),
          input: `round: ${state.round}`,
          output: "transitioning",
        },
      ],
      updatedAt: Date.now(),
    };
  }

  getUncertainty(state: PipelineState): UncertaintyScore {
    return this.calculateUncertainty(state);
  }

  getStopConditions(state: PipelineState): StopCondition[] {
    const metrics = this.getOrCreateMetrics(state.sessionId);
    const conditions: StopCondition[] = [];

    const maxRounds = this.checkMaxRounds(state);
    if (maxRounds) conditions.push(maxRounds);

    const convergence = this.checkConvergence(state);
    if (convergence) conditions.push(convergence);

    const saturation = this.checkSaturation(state, metrics);
    if (saturation) conditions.push(saturation);

    const contradiction = this.checkContradiction(state, metrics);
    if (contradiction) conditions.push(contradiction);

    const uncertainty = this.checkUncertainty(state);
    if (uncertainty) conditions.push(uncertainty);

    return conditions;
  }

  clearMetrics(sessionId: string): void {
    this.metrics.delete(sessionId);
  }
}
