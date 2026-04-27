import type { PipelineState } from "../contracts/state";
import type { Task, TaskType } from "../contracts/task";
import { ProviderRouter } from "../../providers/router/provider-router";
import { getPrompt, prompts } from "./prompts";
import crypto from "crypto";

export interface DecomposeStageConfig {
  maxSubtasks: number;
  minSubtaskImportance: number;
  enableParallel: boolean;
  dependencyAnalysis: boolean;
  useLLM: boolean;
  defaultProvider?: string;
}

export class DecomposeStage {
  private config: DecomposeStageConfig;
  private providerRouter?: ProviderRouter;

  constructor(config?: Partial<DecomposeStageConfig>) {
    this.config = {
      maxSubtasks: 10,
      minSubtaskImportance: 0.1,
      enableParallel: true,
      dependencyAnalysis: true,
      useLLM: false,
      ...config,
    };
  }

  setProviderRouter(router: ProviderRouter): void {
    this.providerRouter = router;
    this.config.useLLM = true;
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    const query = state.request.query;
    let tasks: Task[];

    if (this.config.useLLM && this.providerRouter) {
      tasks = await this.decomposeWithLLM(query, state.protocol, signal);
    } else {
      tasks = this.decomposeQuery(query, state.protocol);
    }

    return {
      ...state,
      tasks,
      history: [
        ...state.history,
        {
          stage: "decompose",
          timestamp: Date.now(),
          input: query,
          output: JSON.stringify(tasks),
        },
      ],
      updatedAt: Date.now(),
    };
  }

  private decomposeQuery(query: string, protocol: string): Task[] {
    const lowerQuery = query.toLowerCase();
    const tasks: Task[] = [];

    // Protocol-specific base tasks
    if (protocol === "adversarial") {
      tasks.push({
        id: `task-${Math.random().toString(36).substring(2, 10)}-pro`,
        type: "build",
        description: "Develop the PRO (supporting) argument",
        input: query,
      });
      tasks.push({
        id: `task-${Math.random().toString(36).substring(2, 10)}-con`,
        type: "critique",
        description: "Develop the CON (opposing) argument",
        input: query,
      });
    } else if (protocol === "red-team") {
      tasks.push({
        id: `task-${Math.random().toString(36).substring(2, 10)}-attack`,
        type: "critique",
        description: "Aggressively challenge all assumptions and find vulnerabilities",
        input: query,
      });
    } else {
      tasks.push({
        id: `task-${Math.random().toString(36).substring(2, 10)}-analyze`,
        type: "analyze",
        description: "Analyze the query and identify key components",
        input: query,
      });
    }

    if (lowerQuery.includes("build") || lowerQuery.includes("create") || lowerQuery.includes("implement")) {
      tasks.push({
        id: `task-${Math.random().toString(36).substring(2, 10)}-build`,
        type: "build",
        description: "Build/implement solution based on requirements",
        input: query,
      });
    }

    if (lowerQuery.includes("verify") || lowerQuery.includes("check") || lowerQuery.includes("validate")) {
      tasks.push({
        id: `task-${Math.random().toString(36).substring(2, 10)}-verify`,
        type: "verify",
        description: "Verify correctness of proposed solution",
        input: query,
      });
    }

    if (lowerQuery.includes("why") || lowerQuery.includes("how") || lowerQuery.includes("explain")) {
      tasks.push({
        id: `task-${Math.random().toString(36).substring(2, 10)}-question`,
        type: "question",
        description: "Investigate via questioning",
        input: query,
      });
    }

    if (lowerQuery.includes("compare") || lowerQuery.includes("versus") || lowerQuery.includes("vs")) {
      tasks.push({
        id: `task-${Math.random().toString(36).substring(2, 10)}-research`,
        type: "research",
        description: "Research and compare alternatives",
        input: query,
      });
    }

    tasks.push({
      id: `task-${Math.random().toString(36).substring(2, 10)}-critique`,
      type: "critique",
      description: "Critically evaluate the analysis",
      input: query,
    });

    tasks.push({
      id: `task-${Math.random().toString(36).substring(2, 10)}-synthesize`,
      type: "synthesize",
      description: "Synthesize final answer from all inputs",
      input: query,
    });

    return tasks.slice(0, this.config.maxSubtasks);
  }

  private async decomposeWithLLM(query: string, protocol: string, signal?: AbortSignal): Promise<Task[]> {
    if (!this.providerRouter) {
      return this.decomposeQuery(query, protocol);
    }

    // Use router to select best provider
    const provider = this.providerRouter.selectProvider({
      preferredProvider: this.config.defaultProvider,
    });
    
    if (!provider || !provider.isAvailable()) {
      return this.decomposeQuery(query, protocol);
    }

    const promptName = `decomposition-${protocol}` as any;
    const prompt = (prompts as any)[promptName] || prompts.decomposition;

    const messages = [
      { role: "system" as const, content: prompt },
      { role: "user" as const, content: query },
    ];

    try {
      const response = await provider.chat(messages, { signal });
      // Parse LLM response into tasks
      const tasks = this.parseLLMTasks(response.content, query);
      return tasks;
    } catch {
      // Fallback to rule-based if LLM fails
      return this.decomposeQuery(query, protocol);
    }
  }

  private parseLLMTasks(content: string, originalQuery: string): Task[] {
    // Try JSON parsing first
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          type?: string;
          description?: string;
          importance?: number;
        }>;
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, this.config.maxSubtasks).map((item, i) => ({
            id: `task-${Date.now()}-${i}`,
            type: (item.type as TaskType) || "analyze",
            description: item.description || `Task ${i + 1}`,
            input: originalQuery,
          }));
        }
      }
    } catch {
      // Not valid JSON, continue with line parsing
    }
    
    if (content.length < 10) {
      return [];
    }
    
    const tasks: Task[] = [];
    const taskTypes = ["analyze", "build", "verify", "critique", "question", "research", "synthesize"];
    
    // Try to extract task descriptions from response and detect type by keywords
    const lines = content.split("\n").filter(l => l.trim());
    
    for (let i = 0; i < Math.min(lines.length, this.config.maxSubtasks); i++) {
      const line = lines[i].replace(/^\d+[\.\)]\s*/, "").trim();
      if (line.length > 5) {
        const lineLower = line.toLowerCase();
        let type: TaskType = "analyze";
        
        // Detect type by keywords
        if (lineLower.includes("verify") || lineLower.includes("check") || lineLower.includes("confirm")) {
          type = "verify";
        } else if (lineLower.includes("build") || lineLower.includes("create") || lineLower.includes("implement")) {
          type = "build";
        } else if (lineLower.includes("critic") || lineLower.includes("flaw") || lineLower.includes("weak")) {
          type = "critique";
        } else if (lineLower.includes("research") || lineLower.includes("find") || lineLower.includes("search")) {
          type = "research";
        } else if (lineLower.includes("question") || lineLower.includes("ask")) {
          type = "question";
        } else if (lineLower.includes("synthes") || lineLower.includes("merge") || lineLower.includes("combine")) {
          type = "synthesize";
        } else {
          type = taskTypes[i % taskTypes.length] as TaskType;
        }
        
        tasks.push({
          id: `task-${Date.now()}-${i}`,
          type,
          description: line.substring(0, 100),
          input: originalQuery,
        });
      }
    }

    // Add default synthesize if not present
    if (!tasks.some(t => t.type === "synthesize")) {
      tasks.push({
        id: `task-${Date.now()}-synthesize`,
        type: "synthesize",
        description: "Synthesize final answer",
        input: originalQuery,
      });
    }

    return tasks;
  }
}