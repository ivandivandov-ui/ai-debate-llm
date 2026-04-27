export interface DebateResult {
  id: string;
  requestId: string;
  query: string;
  finalAnswer: string;
  confidence: number;
  evidence: Evidence[];
  reasoning: ReasoningChain;
  alternatives?: Alternative[];
  metrics: ResultMetrics;
}

export interface Evidence {
  id: string;
  content: string;
  source?: string;
  relevance: number;
  verificationStatus: "verified" | "pending" | "failed";
}

export interface ReasoningChain {
  steps: ReasoningStep[];
  conclusion: string;
}

export interface ReasoningStep {
  id: string;
  description: string;
  agentId: string;
  timestamp: number;
  input: string;
  output: string;
  type: "analysis" | "critique" | "question" | "synthesis";
}

export interface Alternative {
  id: string;
  content: string;
  probability: number;
  reasons: string[];
}

export interface ResultMetrics {
  totalTokens: number;
  totalCost: number;
  totalRounds: number;
  totalAgents: number;
  executionTimeMs: number;
  providersUsed: string[];
}