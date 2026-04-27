import type { AgentRole } from "../../core/contracts/message";
import type { Task, TaskResult } from "../../core/contracts/task";
import { BaseAgent } from "../base/base.agent";
import type { AgentState } from "../base/agent-state";
import { getPrompt } from "../../core/pipeline/prompts";

export interface EvaluationScore {
  accuracy: number;
  neutrality: number;
  coherence: number;
  completeness: number;
  overall: number;
  justification: string;
}

export class JudgeAgent extends BaseAgent {
  readonly role: AgentRole = "judge";
  readonly capabilities = { canUseTools: false, canCommunicate: true, canVerify: true };

  constructor(state: AgentState) {
    super(state);
  }

  protected async performTask(task: Task, _context?: Record<string, unknown>, signal?: AbortSignal): Promise<TaskResult> {
    const systemPrompt = this.state.context.systemPrompt || getPrompt("judge");
    
    // We expect the task input to contain the final answer and possibly the original query
    const result = await this.chatWithLLM(task, systemPrompt, signal);

    if (result.success && typeof result.output === "string") {
      try {
        // Try to parse JSON if the model followed instructions
        const parsed = JSON.parse(result.output);
        return {
          ...result,
          output: parsed
        };
      } catch (e) {
        // If not JSON, return as is (chatWithLLM already handled the basics)
        return result;
      }
    }

    return result;
  }
}
