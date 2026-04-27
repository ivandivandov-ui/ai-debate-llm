export interface DebateResponse {
  success: boolean;
  result?: DebateResultData;
  error?: ErrorResponse;
  metadata: ResponseMetadata;
}

export interface DebateResultData {
  id: string;
  query: string;
  answer: string;
  confidence: number;
  rounds: number;
  agents: string[];
  evidence: EvidenceSummary[];
}

export interface EvidenceSummary {
  source: string;
  content: string;
  verified: boolean;
}

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ErrorCode =
  | "INVALID_REQUEST"
  | "PROVIDER_ERROR"
  | "AGENT_ERROR"
  | "TIMEOUT"
  | "BUDGET_EXCEEDED"
  | "PROTOCOL_ERROR"
  | "INTERNAL_ERROR";

export interface ResponseMetadata {
  requestId: string;
  processingTimeMs: number;
  timestamp: number;
  version: string;
}