import type { PipelineState } from "../../core/contracts/state";
import type { AgentId, AgentRole } from "../../core/contracts/message";

export interface DebateProtocol {
  readonly name: string;
  readonly description: string;
  readonly maxRounds: number;

  createInitialState(state: PipelineState): ProtocolState;
  getNextTurn(state: ProtocolState): TurnDecision;
  shouldContinue(state: ProtocolState): boolean;
  getParticipants(state: ProtocolState): ProtocolParticipant[];
}

export interface ProtocolState {
  round: number;
  phase: ProtocolPhase;
  history: TurnRecord[];
  proposals: Proposal[];
  positions: Map<AgentId, Position>;
}

export type ProtocolPhase = 
  | "opening"
  | "argument"
  | "question"
  | "rebuttal"
  | "synthesis"
  | "conclusion";

export interface TurnRecord {
  round: number;
  agentId: AgentId;
  role: AgentRole;
  action: TurnAction;
  content: string;
  timestamp: number;
}

export type TurnAction = 
  | "propose"
  | "question"
  | "critique"
  | "challenge"
  | "support"
  | "synthesize"
  | "conclude";

export interface Proposal {
  id: string;
  agentId: AgentId;
  content: string;
  evidence: string[];
  confidence: number;
  timestamp: number;
}

export interface ProtocolParticipant {
  agentId: AgentId;
  role: AgentRole;
  turnsRemaining: number;
  status: "active" | "pending" | "exhausted";
}

export interface Position {
  agentId: AgentId;
  stance: "support" | "oppose" | "neutral";
  arguments: string[];
  confidence: number;
}

export interface TurnDecision {
  nextAgent?: AgentId;
  suggestedAction?: TurnAction;
  requiredRoles?: AgentRole[];
  canSkip?: boolean;
}

export interface ProtocolConfig {
  maxRounds?: number;
  minProposals?: number;
  enableQuestions?: boolean;
  requireEvidence?: boolean;
  consensusThreshold?: number;
}

export function createProtocol(_name: string, _config?: ProtocolConfig): DebateProtocol {
  throw new Error("PROTOCOL_NOT_IMPLEMENTED");
}