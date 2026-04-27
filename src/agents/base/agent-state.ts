import type { AgentId, SessionId } from "../../core/contracts/message";
import { isContradiction } from "../../utils/contradictions";

export type AgentLifecycleState =
  | "idle"
  | "initializing"
  | "ready"
  | "processing"
  | "waiting"
  | "responding"
  | "error"
  | "terminated";

export const STATE_TRANSITIONS: Record<AgentLifecycleState, AgentLifecycleState[]> = {
  idle: ["initializing"],
  initializing: ["ready", "error"],
  ready: ["processing", "terminated"],
  processing: ["responding", "error"],
  responding: ["ready", "waiting", "terminated"],
  waiting: ["processing", "ready", "terminated"],
  error: ["ready", "terminated"],
  terminated: [],
};

export interface AgentContext {
  id: AgentId;
  role: string;
  sessionId: SessionId;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  provider: string;
}

export interface AgentBelief {
  statement: string;
  confidence: number;
  source?: string;
  timestamp: number;
}

export interface AgentState {
  id: AgentId;
  context: AgentContext;
  lifecycle: AgentLifecycleState;
  currentTask?: string;
  history: AgentMessage[];
  memory: AgentMemory;
  beliefs: AgentBelief[];
  uncertainties: UncertaintyTracking;
  capabilities: string[];
  tools: string[];
  metrics: AgentMetrics;
  createdAt: number;
  updatedAt: number;
}

export interface UncertaintyTracking {
  score: number;
  sources: string[];
  lastCalculated: number;
  confidenceTrend: number[];
}

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  tokens?: number;
  uncertainty?: number;
}

export interface AgentMemory {
  shortTerm: string[];
  longTerm?: string;
  working: string[];
}

export interface AgentMetrics {
  totalTokens: number;
  totalCost: number;
  requestsCount: number;
  errorsCount: number;
  avgLatencyMs: number;
  avgUncertainty: number;
}

export function createAgentState(
  id: AgentId,
  context: AgentContext,
  capabilities: string[] = [],
  tools: string[] = []
): AgentState {
  const now = Date.now();
  return {
    id,
    context,
    lifecycle: "idle",
    history: [],
    memory: { shortTerm: [], working: [] },
    beliefs: [],
    uncertainties: {
      score: 0.5,
      sources: [],
      lastCalculated: now,
      confidenceTrend: [],
    },
    capabilities,
    tools,
    metrics: {
      totalTokens: 0,
      totalCost: 0,
      requestsCount: 0,
      errorsCount: 0,
      avgLatencyMs: 0,
      avgUncertainty: 0.5,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function transitionState(
  state: AgentState,
  newLifecycle: AgentLifecycleState
): AgentState {
  const allowed = STATE_TRANSITIONS[state.lifecycle];
  if (!allowed.includes(newLifecycle)) {
    throw new Error(
      `Invalid state transition: ${state.lifecycle} -> ${newLifecycle}. Allowed: ${allowed.join(", ")}`
    );
  }
  return {
    ...state,
    lifecycle: newLifecycle,
    updatedAt: Date.now(),
  };
}

export function addBelief(
  state: AgentState,
  belief: string,
  confidence: number,
  source?: string
): AgentState {
  const newBelief: AgentBelief = {
    statement: belief,
    confidence,
    source: source ?? state.context.role,
    timestamp: Date.now(),
  };

  const existing = state.beliefs.findIndex(b => b.statement === belief);
  const beliefs = [...state.beliefs];

  if (existing >= 0) {
    beliefs[existing] = newBelief;
  } else {
    beliefs.push(newBelief);
  }

  return { ...state, beliefs, updatedAt: Date.now() };
}

export function updateUncertainty(
  state: AgentState,
  newScore: number,
  sources: string[]
): AgentState {
  const trend = [...state.uncertainties.confidenceTrend, newScore].slice(-10);

  return {
    ...state,
    uncertainties: {
      score: newScore,
      sources,
      lastCalculated: Date.now(),
      confidenceTrend: trend,
    },
    metrics: {
      ...state.metrics,
      avgUncertainty: trend.reduce((a, b) => a + b, 0) / trend.length,
    },
    updatedAt: Date.now(),
  };
}

export function getBeliefs(state: AgentState, minConfidence: number = 0): AgentBelief[] {
  return state.beliefs.filter(b => b.confidence >= minConfidence);
}

export function getContradictions(state: AgentState): AgentBelief[][] {
  const contradictions: AgentBelief[][] = [];
  
  for (let i = 0; i < state.beliefs.length; i++) {
    for (let j = i + 1; j < state.beliefs.length; j++) {
      const a = state.beliefs[i];
      const b = state.beliefs[j];
      
      if (isContradiction(a.statement, b.statement)) {
        contradictions.push([a, b]);
      }
    }
  }
  
  return contradictions;
}
