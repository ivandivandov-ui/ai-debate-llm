import type { AgentRole } from "../../core/contracts/message";
import type { Task, TaskResult } from "../../core/contracts/task";
import { BaseAgent } from "../base/base.agent";
import type { AgentState } from "../base/agent-state";
import { getPrompt } from "../../core/pipeline/prompts";

export class ScientistAgent extends BaseAgent {
  readonly role: AgentRole = "scientist";
  readonly capabilities = { canUseTools: true, canCommunicate: true, canVerify: true };

  constructor(state: AgentState) {
    super(state);
  }

  protected async performTask(task: Task, _context?: Record<string, unknown>, signal?: AbortSignal): Promise<TaskResult> {
    const content = String(task.input);
    
    // Check if we have provider router to do real research, otherwise fallback to internal logic
    if (this.providerRouter && this.providerRouter.getAllProviders().length > 0) {
      const systemPrompt = this.state.context.systemPrompt || getPrompt("research");
      return this.chatWithLLM(task, systemPrompt, signal);
    }

    return {
      taskId: task.id,
      success: true,
      output: {
        findings: this.gatherEvidence(content),
        conclusion: this.formulateConclusion(content),
      },
      metrics: {
        tokensUsed: content.length / 4,
        latencyMs: 0,
        cost: 0,
        provider: "internal",
      },
    };
  }

  private gatherEvidence(content: string): string[] {
    const evidence: string[] = [];
    const lower = content.toLowerCase();
    evidence.push(`Research query: ${content}`);
    if (lower.includes("what") || lower.includes("how") || lower.includes("why")) {
      evidence.push("Analysis: question requires investigation");
    }
    return evidence;
  }

  private formulateConclusion(content: string): string {
    return `Based on research for: ${content.substring(0, 50)}...`;
  }
}