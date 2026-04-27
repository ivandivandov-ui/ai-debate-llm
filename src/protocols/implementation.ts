import type { 
  DebateProtocol, 
  ProtocolState, 
  TurnDecision, 
  ProtocolParticipant
} from "./base/protocol.interface";
import type { PipelineState } from "../core/contracts/state";
import type { AgentId, AgentRole } from "../core/contracts/message";

function makeProtocolState(base: PipelineState): ProtocolState {
  return {
    round: base.round,
    phase: "opening",
    history: [],
    proposals: [],
    positions: new Map(),
  };
}

export class SocraticProtocol implements DebateProtocol {
  readonly name = "socratic";
  readonly description = "Socratic dialogue through questioning";
  readonly maxRounds = 10;

  private config = { maxRounds: 10, enableQuestions: true };

  createInitialState(state: PipelineState): ProtocolState {
    return {
      ...makeProtocolState(state),
      phase: "opening",
    };
  }

  getNextTurn(state: ProtocolState): TurnDecision {
    if (state.phase === "opening") {
      return {
        suggestedAction: "question",
        requiredRoles: ["scientist"],
      };
    }

    if (state.phase === "question") {
      return {
        suggestedAction: "critique",
        requiredRoles: ["skeptic"],
      };
    }

    return {
      canSkip: true,
      suggestedAction: "synthesize",
    };
  }

  shouldContinue(state: ProtocolState): boolean {
    return state.round < this.config.maxRounds;
  }

  getParticipants(_state: ProtocolState): ProtocolParticipant[] {
    const roles: AgentRole[] = ["scientist", "skeptic", "builder"];
    
    return roles.map((role, i) => ({
      agentId: `agent-${i}` as AgentId,
      role,
      turnsRemaining: this.config.maxRounds,
      status: "active",
    }));
  }
}

export class AdversarialProtocol implements DebateProtocol {
  readonly name = "adversarial";
  readonly description = "Pro vs Con debate";
  readonly maxRounds = 8;

  createInitialState(state: PipelineState): ProtocolState {
    return {
      ...makeProtocolState(state),
      phase: "argument",
    };
  }

  getNextTurn(state: ProtocolState): TurnDecision {
    return {
      suggestedAction: state.phase === "argument" ? "propose" : "critique",
    };
  }

  shouldContinue(state: ProtocolState): boolean {
    return state.round < this.maxRounds;
  }

  getParticipants(_state: ProtocolState): ProtocolParticipant[] {
    return [
      { agentId: "pro" as AgentId, role: "builder", turnsRemaining: 4, status: "active" },
      { agentId: "con" as AgentId, role: "critic", turnsRemaining: 4, status: "active" },
    ];
  }
}

export class RedTeamProtocol implements DebateProtocol {
  readonly name = "red-team";
  readonly description = "Attack and defense";
  readonly maxRounds = 6;

  createInitialState(state: PipelineState): ProtocolState {
    return {
      ...makeProtocolState(state),
      phase: "argument",
    };
  }

  getNextTurn(_state: ProtocolState): TurnDecision {
    return {
      suggestedAction: "challenge",
      requiredRoles: ["skeptic"],
    };
  }

  shouldContinue(state: ProtocolState): boolean {
    return state.round < this.maxRounds;
  }

  getParticipants(_state: ProtocolState): ProtocolParticipant[] {
    return [
      { agentId: "builder" as AgentId, role: "builder", turnsRemaining: 3, status: "active" },
      { agentId: "skeptic" as AgentId, role: "skeptic", turnsRemaining: 3, status: "active" },
      { agentId: "verifier" as AgentId, role: "verifier", turnsRemaining: 3, status: "active" },
    ];
  }
}

export class ConsensusProtocol implements DebateProtocol {
  readonly name = "consensus";
  readonly description = "Seek agreement";
  readonly maxRounds = 5;

  createInitialState(state: PipelineState): ProtocolState {
    return {
      ...makeProtocolState(state),
      phase: "opening",
    };
  }

  getNextTurn(_state: ProtocolState): TurnDecision {
    return {
      suggestedAction: "support",
      canSkip: false,
    };
  }

  shouldContinue(state: ProtocolState): boolean {
    return state.round < this.maxRounds;
  }

  getParticipants(_state: ProtocolState): ProtocolParticipant[] {
    return [
      { agentId: "agent-1" as AgentId, role: "builder", turnsRemaining: 2, status: "active" },
      { agentId: "agent-2" as AgentId, role: "critic", turnsRemaining: 2, status: "active" },
      { agentId: "agent-3" as AgentId, role: "scientist", turnsRemaining: 2, status: "active" },
    ];
  }
}

export class ProtocolRegistry {
  private protocols: Map<string, DebateProtocol> = new Map();

  register(protocol: DebateProtocol): void {
    this.protocols.set(protocol.name, protocol);
  }

  get(name: string): DebateProtocol | undefined {
    return this.protocols.get(name);
  }

  getAll(): DebateProtocol[] {
    return Array.from(this.protocols.values());
  }
}
