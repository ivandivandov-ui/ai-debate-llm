import type { PipelineState, PipelineStage } from "../contracts/state";
import type { DebateRequest } from "../contracts/request";
import type { DebateResult } from "../contracts/result";

import { GraphBuilder } from "./graph-builder";
import { NodeRegistry } from "./node-registry";
import { EdgeResolver } from "./edge-resolver";
import { CheckpointManager } from "./checkpoint";

import { InputStage } from "../pipeline/input";
import { DecomposeStage } from "../pipeline/decompose";
import { DispatchStage } from "../pipeline/dispatch";
import { CollectStage } from "../pipeline/collect";
import { VerifyStage } from "../pipeline/verify";
import { DecisionStage } from "../pipeline/decision";
import { FuseStage } from "../pipeline/fuse";
import { StoreStage } from "../pipeline/store";
import { OutputStage } from "../pipeline/output";

export interface ExecutorConfig {
  timeout: number;
  enableCheckpoints: boolean;
  checkpointInterval: number;
}

/**
 * Custom pipeline executor - does NOT use langgraph library
 * Implements a state-machine based execution model
 */
export class CustomPipelineExecutor {
  private nodes: NodeRegistry;
  private resolver: EdgeResolver;
  private checkpointManager?: CheckpointManager;
  private config: ExecutorConfig;

  constructor(config?: Partial<ExecutorConfig>) {
    this.config = {
      timeout: 300000,
      enableCheckpoints: false,
      checkpointInterval: 5,
      ...config,
    };

    this.nodes = new NodeRegistry();
    this.resolver = new EdgeResolver();
    this.registerDefaultNodes();
  }

  private registerDefaultNodes(): void {
    const inputStage = new InputStage();
    const decomposeStage = new DecomposeStage();
    const dispatchStage = new DispatchStage();
    const collectStage = new CollectStage();
    const verifyStage = new VerifyStage();
    const decisionStage = new DecisionStage();
    const fuseStage = new FuseStage();
    const storeStage = new StoreStage();
    const outputStage = new OutputStage();

    this.nodes.register({ name: "input", handler: inputStage.execute.bind(inputStage) });
    this.nodes.register({ name: "decompose", handler: decomposeStage.execute.bind(decomposeStage) });
    this.nodes.register({ name: "dispatch", handler: dispatchStage.execute.bind(dispatchStage) });
    this.nodes.register({ name: "collect", handler: collectStage.execute.bind(collectStage) });
    this.nodes.register({ name: "verify", handler: verifyStage.execute.bind(verifyStage) });
    this.nodes.register({ name: "decision", handler: decisionStage.execute.bind(decisionStage) });
    this.nodes.register({ name: "fuse", handler: fuseStage.execute.bind(fuseStage) });
    this.nodes.register({ name: "store", handler: storeStage.execute.bind(storeStage) });
    this.nodes.register({ name: "output", handler: outputStage.execute.bind(outputStage) });
  }

  async execute(request: DebateRequest): Promise<DebateResult> {
    const sessionId = `session-${Date.now()}`;
    let state = this.createInitialState(request, sessionId);

    const startTime = Date.now();
    let iterations = 0;
    const maxIterations = 1000;

    while (!state.isComplete && iterations < maxIterations) {
      if (Date.now() - startTime > this.config.timeout) {
        throw new Error("TIMEOUT: Execution exceeded timeout");
      }

      const currentStage = state.stage;
      const handler = this.nodes.getHandler(currentStage);

      if (!handler) {
        throw new Error(`NO_HANDLER: No handler for stage ${currentStage}`);
      }

      state = await handler(state);

      if (this.config.enableCheckpoints && this.checkpointManager) {
        if (iterations % this.config.checkpointInterval === 0) {
          await this.checkpointManager.save(sessionId, state);
        }
      }

      const nextStage = this.resolver.resolve(state);
      if (nextStage === "END") {
        state.isComplete = true;
        break;
      }

      if (nextStage !== currentStage) {
        state.stage = nextStage;
      }

      iterations++;
    }

    return this.buildResult(state);
  }

  private createInitialState(request: DebateRequest, sessionId: string): PipelineState {
    const now = Date.now();
    return {
      request,
      sessionId,
      protocol: request.protocol || request.preferences?.protocols?.[0] || "socratic",
      stage: "input" as PipelineStage,
      round: 0,
      tasks: [],
      results: [],
      messages: [],
      history: [],
      verification: { pending: [], verified: [], failed: [] },
      synthesis: { candidates: [] },
      uncertainty: {
        score: 0.5,
        sources: [],
        trend: [],
        lastCalculated: now,
      },
      isComplete: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  private buildResult(state: PipelineState): DebateResult {
    const synthesis = state.synthesis;
    const bestCandidate = synthesis.candidates[0];
    const finalAnswer = bestCandidate?.content ?? "No result available";

    return {
      id: state.sessionId,
      requestId: state.request.id,
      query: state.request.query,
      finalAnswer,
      confidence: bestCandidate?.confidence ?? 0,
      evidence: [],
      reasoning: {
        steps: state.history.map((h, i) => ({
          id: `step-${i}`,
          description: h.stage,
          agentId: h.agentId ?? "system",
          timestamp: h.timestamp,
          input: h.input,
          output: h.output,
          type: "synthesis",
        })),
        conclusion: finalAnswer,
      },
      metrics: {
        totalTokens: state.results.reduce((sum, r) => sum + r.metrics.tokensUsed, 0),
        totalCost: state.results.reduce((sum, r) => sum + r.metrics.cost, 0),
        totalRounds: state.round,
        totalAgents: 1,
        executionTimeMs: Date.now() - state.createdAt,
        providersUsed: [...new Set(state.results.map((r) => r.metrics.provider))],
      },
    };
  }

  setCheckpointManager(manager: CheckpointManager): void {
    this.checkpointManager = manager;
  }

  getState(sessionId: string): Promise<PipelineState | null> {
    return this.checkpointManager?.getLatest(sessionId) ?? Promise.resolve(null);
  }
}

export function createExecutor(config?: Partial<ExecutorConfig>): CustomPipelineExecutor {
  return new CustomPipelineExecutor(config);
}
