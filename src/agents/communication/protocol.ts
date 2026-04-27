import type { AgentId, SessionId, A2AMessage, MessageType } from "../../core/contracts/message";
import type { AgentState } from "../base/agent-state";

export type TurnPolicy = "unlimited" | "fixed" | "adaptive";
export type CostPolicy = "no-limit" | "budget" | "auto";
export type AccessPolicy = "open" | "role-restricted" | "explicit";

export interface TurnLimitConfig {
  mode: "unlimited" | "fixed" | "adaptive";
  maxTurns?: number;
  maxTurnsPerRole?: Record<string, number>;
}

export interface CostGuardConfig {
  mode: "no-limit" | "budget" | "auto";
  maxBudget?: number;
  warnAt?: number;
  blockAt?: number;
}

export interface RoleAccessConfig {
  mode: "open" | "role-restricted" | "explicit";
  allowedSenders?: Record<string, AgentId[]>;
  allowedRecipients?: Record<string, AgentId[]>;
}

export interface A2APolicy {
  turnLimit: TurnLimitConfig;
  costGuard: CostGuardConfig;
  roleAccess: RoleAccessConfig;
}

export interface ProtocolRules {
  allowedMessageTypes: MessageType[];
  requiredAck: boolean;
  ackTimeout: number;
  maxRetries: number;
  routingRules: RoutingRule[];
}

export interface RoutingRule {
  from: AgentId | "*";
  to: AgentId | "*";
  allowedTypes: MessageType[];
  conditions?: (msg: A2AMessage, state: AgentState) => boolean;
}

export class A2AProtocol {
  private policies: Map<SessionId, A2APolicy> = new Map();
  private rules: Map<SessionId, ProtocolRules> = new Map();
  private turnCount: Map<SessionId, Map<AgentId, number>> = new Map();

  setPolicy(sessionId: SessionId, policy: A2APolicy): void {
    this.policies.set(sessionId, policy);
    if (policy.turnLimit.mode === "fixed" || policy.turnLimit.mode === "adaptive") {
      this.turnCount.set(sessionId, new Map());
    }
  }

  getPolicy(sessionId: SessionId): A2APolicy | undefined {
    return this.policies.get(sessionId);
  }

  setRules(sessionId: SessionId, rules: ProtocolRules): void {
    this.rules.set(sessionId, rules);
  }

  getRules(sessionId: SessionId): ProtocolRules | undefined {
    return this.rules.get(sessionId);
  }

  canSend(sessionId: SessionId, sender: AgentId, messageType: MessageType): { allowed: boolean; reason?: string } {
    // Check routing rules if configured
    const rules = this.rules.get(sessionId);
    if (rules) {
      const routingRule = rules.routingRules.find(
        (r) => (r.from === sender || r.from === "*") && r.allowedTypes.includes(messageType)
      );
      if (!routingRule) {
        return { allowed: false, reason: `Message type ${messageType} not allowed from ${sender}` };
      }
    }

    // Check turn limits (independent of routing rules)
    const policy = this.policies.get(sessionId);
    if (!policy) return { allowed: true };

    if (policy.turnLimit.mode !== "unlimited") {
      const turns = this.turnCount.get(sessionId);
      if (turns) {
        const currentTurns = turns.get(sender) ?? 0;
        const maxTurns = policy.turnLimit.maxTurns ?? 10;
        if (currentTurns >= maxTurns) {
          return { allowed: false, reason: "Turn limit reached" };
        }
      }
    }

    return { allowed: true };
  }

  recordTurn(sessionId: SessionId, sender: AgentId): void {
    const policy = this.policies.get(sessionId);
    if (!policy || policy.turnLimit.mode === "unlimited") return;

    let turns = this.turnCount.get(sessionId);
    if (!turns) {
      turns = new Map();
      this.turnCount.set(sessionId, turns);
    }
    turns.set(sender, (turns.get(sender) ?? 0) + 1);
  }

  getRemainingTurns(sessionId: SessionId, agentId: AgentId): number {
    const policy = this.policies.get(sessionId);
    if (!policy || policy.turnLimit.mode === "unlimited") return Infinity;

    const turns = this.turnCount.get(sessionId);
    const used = turns?.get(agentId) ?? 0;
    const max = policy.turnLimit.maxTurns ?? 10;
    return Math.max(0, max - used);
  }

  canAfford(sessionId: SessionId, estimatedCost: number, sender: AgentId): { allowed: boolean; reason?: string } {
    const policy = this.policies.get(sessionId);
    if (!policy || policy.costGuard.mode === "no-limit") return { allowed: true };

    if (policy.costGuard.mode === "budget") {
      const remaining = policy.costGuard.maxBudget ?? 0;
      if (estimatedCost > remaining) {
        return { allowed: false, reason: "Budget exceeded" };
      }
    }

    return { allowed: true };
  }

  canAccess(sessionId: SessionId, sender: AgentId, recipient: AgentId, senderRole: string): { allowed: boolean; reason?: string } {
    const policy = this.policies.get(sessionId);
    if (!policy || policy.roleAccess.mode === "open") return { allowed: true };

    const access = policy.roleAccess;
    if (access.mode === "role-restricted") {
      const allowedRecipients = access.allowedRecipients?.[senderRole];
      if (allowedRecipients && !allowedRecipients.includes(recipient)) {
        return { allowed: false, reason: `Role ${senderRole} cannot send to ${recipient}` };
      }
    }

    return { allowed: true };
  }

  cleanup(sessionId: SessionId): void {
    this.policies.delete(sessionId);
    this.rules.delete(sessionId);
    this.turnCount.delete(sessionId);
  }
}