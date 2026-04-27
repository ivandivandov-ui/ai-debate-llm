import type { AgentRole } from "../../core/contracts/message";
import type { Task, TaskResult } from "../../core/contracts/task";
import { BaseAgent } from "../base/base.agent";
import type { AgentState } from "../base/agent-state";
import { getPrompt } from "../../core/pipeline/prompts";

export class CriticAgent extends BaseAgent {
  readonly role: AgentRole = "critic";
  readonly capabilities = { canUseTools: true, canCommunicate: true, canVerify: true };

  constructor(state: AgentState) {
    super(state);
  }

  protected async performTask(task: Task, _context?: Record<string, unknown>, signal?: AbortSignal): Promise<TaskResult> {
    const systemPrompt = this.state.context.systemPrompt || getPrompt("critique");
    
    // Use the robust chat logic from BaseAgent
    return this.chatWithLLM(task, systemPrompt, signal);
  }
}