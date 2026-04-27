import type { AgentId, SessionId, A2AMessage, MessageType, AgentRole } from "../../core/contracts/message";
import type { AgentState } from "../base/agent-state";

export interface RoutingTarget {
  agentId: AgentId;
  priority: number;
  reason?: string;
}

export interface RoutingContext {
  sessionId: SessionId;
  round: number;
  initiator: AgentId;
  participants: AgentId[];
  history: A2AMessage[];
}

export type RoutingStrategy = "direct" | "broadcast" | "role-based" | "round-robin" | "adaptive" | "cost-optimized";

export interface RouterConfig {
  defaultStrategy: RoutingStrategy;
  allowSelfMessage: boolean;
  maxHops: number;
  timeoutMs: number;
}

const ROLE_TO_RECIPIENT: Record<AgentRole, AgentRole[]> = {
  builder: ["critic", "skeptic"],
  critic: ["builder", "scientist", "verifier"],
  skeptic: ["builder", "critic"],
  scientist: ["critic", "verifier"],
  verifier: ["builder", "critic", "skeptic", "scientist"],
  judge: ["builder", "critic"],
};

export class A2ARouter {
  private agents: Map<AgentId, AgentState> = new Map();
  private config: RouterConfig;
  private roundRobinIndex: Map<SessionId, number> = new Map();

  constructor(config?: Partial<RouterConfig>) {
    this.config = {
      defaultStrategy: "direct",
      allowSelfMessage: false,
      maxHops: 5,
      timeoutMs: 30000,
      ...config,
    };
  }

  registerAgent(agentId: AgentId, state: AgentState): void {
    this.agents.set(agentId, state);
    this.roundRobinIndex.set(state.context.sessionId, 0);
  }

  unregisterAgent(agentId: AgentId): void {
    this.agents.delete(agentId);
  }

  getAgent(agentId: AgentId): AgentState | undefined {
    return this.agents.get(agentId);
  }

  route(
    sender: AgentId,
    context: RoutingContext,
    messageType: MessageType,
    strategy?: RoutingStrategy
  ): RoutingTarget[] {
    const s = strategy ?? this.config.defaultStrategy;

    switch (s) {
      case "direct":
        return this.routeDirect(sender, context);
      case "broadcast":
        return this.routeBroadcast(sender, context);
      case "role-based":
        return this.routeRoleBased(sender, context);
      case "round-robin":
        return this.routeRoundRobin(sender, context);
      case "adaptive":
        return this.routeAdaptive(sender, context, messageType);
      case "cost-optimized":
        return this.routeCostOptimized(sender, context);
      default:
        return this.routeDirect(sender, context);
    }
  }

  private routeDirect(sender: AgentId, context: RoutingContext): RoutingTarget[] {
    const others = context.participants.filter((id) => id !== sender);
    const target = others[0];

    if (!target) return [];
    if (!this.config.allowSelfMessage && target === sender) return [];

    return [{ agentId: target, priority: 1, reason: "direct" }];
  }

  private routeBroadcast(sender: AgentId, context: RoutingContext): RoutingTarget[] {
    return context.participants
      .filter((id) => id !== sender || this.config.allowSelfMessage)
      .map((id) => ({ agentId: id, priority: 1, reason: "broadcast" }));
  }

  private routeRoleBased(sender: AgentId, context: RoutingContext): RoutingTarget[] {
    const senderState = this.agents.get(sender);
    if (!senderState) return [];

    const senderRole = senderState.context.role as AgentRole;
    const allowedRoles = ROLE_TO_RECIPIENT[senderRole] ?? [];
    const targets: RoutingTarget[] = [];

    for (const participantId of context.participants) {
      if (participantId === sender && !this.config.allowSelfMessage) continue;

      const participantState = this.agents.get(participantId);
      if (!participantState) continue;

      const participantRole = participantState.context.role as AgentRole;
      if (allowedRoles.includes(participantRole)) {
        targets.push({ agentId: participantId, priority: 1, reason: `role:${senderRole}->${participantRole}` });
      }
    }

    return targets;
  }

  private routeRoundRobin(sender: AgentId, context: RoutingContext): RoutingTarget[] {
    const others = context.participants.filter((id) => id !== sender || this.config.allowSelfMessage);
    if (others.length === 0) return [];

    const idx = this.roundRobinIndex.get(context.sessionId) ?? 0;
    const target = others[idx % others.length];

    this.roundRobinIndex.set(context.sessionId, idx + 1);

    return [{ agentId: target, priority: 1, reason: `round-${idx}` }];
  }

  private routeAdaptive(sender: AgentId, context: RoutingContext, messageType: MessageType): RoutingTarget[] {
    const hasRecentResponse = context.history.some(
      (msg) =>
        msg.recipient === sender &&
        Date.now() - msg.timestamp < 60000 &&
        (msg.type === "response" || msg.type === "evidence")
    );

    if (hasRecentResponse) {
      return this.routeDirect(sender, context);
    } else if (context.round > 2) {
      return this.routeBroadcast(sender, context);
    } else {
      return this.routeRoleBased(sender, context);
    }
  }

  private routeCostOptimized(sender: AgentId, context: RoutingContext): RoutingTarget[] {
    const targets: RoutingTarget[] = [];

    for (const participantId of context.participants) {
      if (participantId === sender && !this.config.allowSelfMessage) continue;

      const state = this.agents.get(participantId);
      if (!state) continue;

      const costPer1k = state.metrics.totalCost / (state.metrics.requestsCount || 1);
      const priority = Math.max(1, 100 - costPer1k * 10);

      targets.push({ agentId: participantId, priority, reason: `cost:${costPer1k}` });
    }

    return targets.sort((a, b) => b.priority - a.priority);
  }

  getParticipants(sessionId: SessionId): AgentId[] {
    const participants: AgentId[] = [];
    for (const [id, state] of this.agents) {
      if (state.context.sessionId === sessionId) {
        participants.push(id);
      }
    }
    return participants;
  }

  cleanup(sessionId: SessionId): void {
    this.roundRobinIndex.delete(sessionId);
    for (const [id, state] of this.agents) {
      if (state.context.sessionId === sessionId) {
        this.agents.delete(id);
      }
    }
  }
}