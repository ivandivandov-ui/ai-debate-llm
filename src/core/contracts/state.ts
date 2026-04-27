import type { A2AMessage } from "./message";
import type { Task, TaskResult } from "./task";
import type { DebateRequest } from "./request";

export interface PipelineState {
  request: DebateRequest;
  sessionId: string;
  protocol: string;
  
  stage: PipelineStage;
  round: number;
  
  tasks: Task[];
  results: TaskResult[];
  
  messages: A2AMessage[];
  history: HistoryEntry[];
  
  currentAgent?: string;
  nextAgent?: string;
  
  verification: VerificationState;
  synthesis: SynthesisState;
  
  humanInput?: string;
  uncertainty: PipelineUncertainty;
  
  isComplete: boolean;
  stopped?: boolean;
  stopReason?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PipelineUncertainty {
  score: number;
  sources: string[];
  trend: number[];
  lastCalculated: number;
}

export type PipelineStage = 
  | "input"
  | "decompose"
  | "dispatch"
  | "collect"
  | "verify"
  | "decision"
  | "fuse"
  | "judge"
  | "store"
  | "output"
  | "human";

export interface HistoryEntry {
  stage: PipelineStage;
  timestamp: number;
  agentId?: string;
  input: string;
  output: string;
}

export interface VerificationState {
  pending: VerificationItem[];
  verified: VerificationItem[];
  failed: VerificationItem[];
}

export interface VerificationItem {
  id: string;
  content: string;
  type: "factual" | "logical" | "consistency" | "safety";
  status: "pending" | "passed" | "failed";
  errors?: string[];
}

export interface SynthesisState {
  candidates: SynthesisCandidate[];
  final?: SynthesisResult;
}

export interface SynthesisCandidate {
  id: string;
  content: string;
  agentId: string;
  confidence: number;
  votes: number;
}

export interface SynthesisResult {
  content: string;
  confidence: number;
  evidence: string[];
}

export function createInitialState(request: DebateRequest, sessionId: string): PipelineState {
  const now = Date.now();
  return {
    request,
    sessionId,
    protocol: request.protocol || request.preferences?.protocols?.[0] || "socratic",
    stage: "input",
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