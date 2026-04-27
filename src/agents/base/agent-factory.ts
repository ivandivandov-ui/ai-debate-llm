import type { AgentId, AgentRole, SessionId } from "../../core/contracts/message";
import type { IAgent, AgentConfig, AgentFactory, AgentRegistry, AgentCapabilities } from "./agent.interface";
export type { IAgent };
import { createAgentState, type AgentState, transitionState } from "./agent-state";

import { BuilderAgent } from "../roles/builder.agent";
import { CriticAgent } from "../roles/critic.agent";
import { SkepticAgent } from "../roles/skeptic.agent";
import { ScientistAgent } from "../roles/scientist.agent";
import { VerifierAgent } from "../roles/verifier.agent";
import { JudgeAgent } from "../roles/judge.agent";

const ROLE_PROMPTS: Record<AgentRole, string> = {
  builder: "You are a Builder agent. Your role is to construct solutions and proposals.",
  critic: "You are a Critic agent. Your role is to critically evaluate and find flaws.",
  skeptic: "You are a Skeptic agent. Your role is to question assumptions.",
  scientist: "You are a Scientist agent. Your role is to research and investigate.",
  verifier: "You are a Verifier agent. Your role is to verify factual accuracy.",
  judge: "You are a Judge agent. Your role is to evaluate response quality.",
};

const ROLE_CAPABILITIES: Record<AgentRole, AgentCapabilities> = {
  builder: { canUseTools: true, canCommunicate: true, canVerify: false },
  critic: { canUseTools: true, canCommunicate: true, canVerify: true },
  skeptic: { canUseTools: true, canCommunicate: true, canVerify: false },
  scientist: { canUseTools: true, canCommunicate: true, canVerify: false },
  verifier: { canUseTools: true, canCommunicate: true, canVerify: true },
  judge: { canUseTools: false, canCommunicate: true, canVerify: true },
};

export class DefaultAgentFactory implements AgentFactory {
  private registry: DefaultAgentRegistry;

  constructor() {
    this.registry = new DefaultAgentRegistry();
  }

  async create(config: AgentConfig): Promise<IAgent> {
    const capabilities = ROLE_CAPABILITIES[config.role];
    const systemPrompt = config.systemPrompt ?? ROLE_PROMPTS[config.role];

    const agentState = createAgentState(
      config.id,
      {
        id: config.id,
        role: config.role,
        sessionId: config.sessionId,
        systemPrompt,
        maxTokens: config.maxTokens ?? 4096,
        temperature: config.temperature ?? 0.7,
        provider: config.provider ?? "default",
      },
      [],
      []
    );

    const agent = await this.createAgent(config.role, agentState);
    this.registry.register(agent);

    return agent;
  }

  async createWithRole(role: AgentRole, sessionId: SessionId): Promise<IAgent> {
    const id = `${role}-${Date.now()}` as AgentId;
    return this.create({
      id,
      role,
      sessionId,
      name: role,
    });
  }

  private async createAgent(role: AgentRole, state: AgentState): Promise<IAgent> {
    const agents: Record<AgentRole, () => IAgent> = {
      builder: () => new BuilderAgent(state),
      critic: () => new CriticAgent(state),
      skeptic: () => new SkepticAgent(state),
      scientist: () => new ScientistAgent(state),
      verifier: () => new VerifierAgent(state),
      judge: () => new JudgeAgent(state),
    };

    const create = agents[role];
    if (!create) {
      throw new Error(`UNKNOWN_ROLE: ${role}`);
    }

    return create();
  }

  getRegistry(): AgentRegistry {
    return this.registry;
  }
}

class DefaultAgentRegistry implements AgentRegistry {
  private agents: Map<AgentId, IAgent> = new Map();

  register(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  unregister(agentId: AgentId): void {
    this.agents.delete(agentId);
  }

  get(agentId: AgentId): IAgent | undefined {
    return this.agents.get(agentId);
  }

  getAll(): IAgent[] {
    return Array.from(this.agents.values());
  }

  getByRole(role: AgentRole): IAgent[] {
    return this.getAll().filter((a) => a.role === role);
  }
}

export function createAgentFactory(): AgentFactory {
  return new DefaultAgentFactory();
}