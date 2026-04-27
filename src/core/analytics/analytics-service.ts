import { getAllDebates } from "../../persistence/database";
import type { DebateResult } from "../contracts/result";

export interface AnalyticsSummary {
  totalDebates: number;
  totalCost: number;
  totalTokens: number;
  avgExecutionTimeMs: number;
  consensusRate: number;
  providerDistribution: Record<string, number>;
  modelDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
}

export class AnalyticsService {
  async getSummary(): Promise<AnalyticsSummary> {
    const debates = await getAllDebates(1000, 0); // Get last 1000 debates
    
    let totalCost = 0;
    let totalTokens = 0;
    let totalExecutionTime = 0;
    let completedDebates = 0;
    let consensusCount = 0;
    const providerDistribution: Record<string, number> = {};
    const modelDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};

    for (const debate of debates) {
      statusDistribution[debate.status] = (statusDistribution[debate.status] || 0) + 1;
      
      if (debate.status === "completed" && debate.result) {
        const result = debate.result as DebateResult;
        completedDebates++;
        totalCost += result.metrics.totalCost;
        totalTokens += result.metrics.totalTokens;
        totalExecutionTime += result.metrics.executionTimeMs;

        // Consensus check (rough)
        if (result.finalAnswer && !result.finalAnswer.includes("NO_CONSENSUS")) {
          consensusCount++;
        }

        for (const provider of result.metrics.providersUsed) {
          providerDistribution[provider] = (providerDistribution[provider] || 0) + 1;
        }
      }
    }

    return {
      totalDebates: debates.length,
      totalCost,
      totalTokens,
      avgExecutionTimeMs: completedDebates > 0 ? totalExecutionTime / completedDebates : 0,
      consensusRate: completedDebates > 0 ? consensusCount / completedDebates : 0,
      providerDistribution,
      modelDistribution,
      statusDistribution,
    };
  }
}
