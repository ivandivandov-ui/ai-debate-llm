import type { AgentRole } from "./message";

export interface Task {
  id: string;
  type: TaskType;
  description: string;
  input: unknown;
  constraints?: TaskConstraints;
  context?: Record<string, unknown>;
  assignedAgent?: string;
}

export type TaskType = 
  | "analyze" 
  | "build" 
  | "verify" 
  | "critique" 
  | "question" 
  | "synthesize" 
  | "research" 
  | "refine";

export interface TaskConstraints {
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  metrics: TaskMetrics;
  uncertainty?: UncertaintyInfo;
  assumptions?: string[];
  failureModes?: string[];
}

export interface UncertaintyInfo {
  confidence: number;
  uncertainty: number;
  sources: UncertaintySource[];
  breakdown: Record<string, number>;
}

export type UncertaintySource = 
  | "insufficient_data"
  | "model_limitation"
  | "edge_case"
  | "contradictory_sources"
  | "complexity";

export interface TaskMetrics {
  tokensUsed: number;
  latencyMs: number;
  cost: number;
  provider: string;
}