import type { AgentId, AgentRole, SessionId } from "../../core/contracts/message";
import type { Task, TaskResult } from "../../core/contracts/task";

export interface AgentConfig {
  id: AgentId;
  role: AgentRole;
  sessionId: SessionId;
  name: string;
  description?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  provider?: string;
}

export interface AgentInput {
  task: Task;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface AgentOutput {
  result: TaskResult;
  messages?: AgentMessage[];
}

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface CognitiveModel {
  type: "fast" | "slow" | "creative";
  temperature?: number;
  maxTokens?: number;
}

export interface AgentCapabilities {
  canUseTools: boolean;
  canCommunicate: boolean;
  canVerify: boolean;
  maxConcurrentTasks?: number;
}

export interface IAgent {
  readonly id: AgentId;
  readonly role: AgentRole;
  readonly sessionId: SessionId;
  readonly capabilities: AgentCapabilities;

  initialize(): Promise<void>;
  execute(input: AgentInput): Promise<AgentOutput>;
  terminate(): Promise<void>;
  getState(): AgentSnapshot;
  setProviderRouter(router: import("../../providers/router/provider-router").ProviderRouter): void;
}

export interface AgentSnapshot {
  id: AgentId;
  role: AgentRole;
  status: "idle" | "initialized" | "running" | "terminated";
  lastExecution?: number;
  tasksCompleted: number;
  errorsCount: number;
}

export interface AgentFactory {
  create(config: AgentConfig): Promise<IAgent>;
  createWithRole(role: AgentRole, sessionId: SessionId): Promise<IAgent>;
}

export interface AgentRegistry {
  register(agent: IAgent): void;
  unregister(agentId: AgentId): void;
  get(agentId: AgentId): IAgent | undefined;
  getAll(): IAgent[];
  getByRole(role: AgentRole): IAgent[];
}