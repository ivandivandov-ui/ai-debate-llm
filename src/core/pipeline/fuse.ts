import type { PipelineState, PipelineStage, SynthesisState, SynthesisCandidate } from "../contracts/state";
import type { TaskResult } from "../contracts/task";
import { isContradiction } from "../../utils/contradictions";
import { ProviderRouter } from "../../providers/router/provider-router";
import { getPrompt } from "./prompts";

export interface FuseResult {
  hasConsensus: boolean;
  confidence: number;
  contradictions: string[];
  preserveAmbiguity: boolean;
  finalContent?: string;
}

export interface FuseStageConfig {
  strategy: "merge" | "voting" | "ranking" | "weighted" | "llm";
  minCandidates: number;
  maxCandidates: number;
  preserveContradictions: boolean;
  allowNoAnswer: boolean;
  contradictionThreshold: number;
}

export class FuseStage {
  private config: FuseStageConfig;
  private providerRouter?: ProviderRouter;

  constructor(config?: Partial<FuseStageConfig>) {
    this.config = {
      strategy: "voting",
      minCandidates: 1,
      maxCandidates: 5,
      preserveContradictions: true,
      allowNoAnswer: true,
      contradictionThreshold: 0.3,
      ...config,
    };
  }

  setProviderRouter(router: ProviderRouter): void {
    this.providerRouter = router;
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    if (signal?.aborted) throw new Error("ABORTED");
    const candidates = state.results
      .filter(r => r.success && r.output)
      .map((r, i) => ({
        id: `candidate-${i}`,
        content: String(r.output),
        agentId: r.taskId,
        confidence: 0.5,
        votes: 1,
      }));

    if (candidates.length === 0) {
      return this.handleNoCandidates(state);
    }

    const contradictions = this.detectContradictions(candidates);

    const fuseResult = await this.synthesize(candidates, contradictions, state, signal);

    const synthesis: SynthesisState = {
      candidates,
      final: fuseResult.finalContent ? {
        content: fuseResult.finalContent,
        confidence: fuseResult.confidence,
        evidence: contradictions,
      } : undefined,
    };

    if (!fuseResult.hasConsensus && !fuseResult.finalContent) {
      synthesis.candidates = this.preserveTopCandidates(candidates, contradictions);
    }

    const shouldStopWithoutConsensus = !fuseResult.hasConsensus && this.config.allowNoAnswer;
    const nextStage: PipelineStage = fuseResult.hasConsensus || shouldStopWithoutConsensus ? "store" : "decision";
    const stopReason = shouldStopWithoutConsensus ? "NO_CONSENSUS" : undefined;

    return {
      ...state,
      synthesis,
      history: [
        ...state.history,
        {
          stage: "fuse",
          timestamp: Date.now(),
          input: `${candidates.length} candidates processed`,
          output: fuseResult.finalContent || "no consensus",
        },
      ],
      updatedAt: Date.now(),
    };
  }

  private async synthesize(
    candidates: SynthesisCandidate[],
    contradictions: string[],
    state: PipelineState,
    signal?: AbortSignal
  ): Promise<FuseResult> {
    if (candidates.length < 2) {
      return {
        hasConsensus: true,
        confidence: candidates[0]?.confidence ?? 0.5,
        contradictions: [],
        preserveAmbiguity: false,
        finalContent: candidates[0]?.content,
      };
    }

    const contradictionRatio = contradictions.length / candidates.length;

    if (contradictionRatio > this.config.contradictionThreshold) {
      if (this.config.allowNoAnswer) {
        return {
          hasConsensus: false,
          confidence: 0.3,
          contradictions,
          preserveAmbiguity: true,
          finalContent: `CONFLICT_DETECTED: ${this.formatConflict(contradictions)}`,
        };
      }
    }

    const avgConfidence = candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length;
    const hasStrongMajority = this.hasStrongMajority(candidates);

    if (!hasStrongMajority && this.config.preserveContradictions) {
      return {
        hasConsensus: false,
        confidence: avgConfidence * 0.7,
        contradictions,
        preserveAmbiguity: true,
        finalContent: this.formatPartialAgreement(candidates, contradictions),
      };
    }

    let selected: SynthesisCandidate;
    switch (this.config.strategy) {
      case "voting":
        selected = this.strategyVoting(candidates);
        break;
      case "ranking":
        selected = this.strategyRanking(candidates);
        break;
      case "weighted":
        selected = this.strategyWeighted(candidates);
        break;
      case "llm":
        selected = await this.strategyMergeLLM(candidates, signal);
        break;
      case "merge":
      default:
        selected = this.strategyMerge(candidates);
    }

    return {
      hasConsensus: true,
      confidence: selected.confidence,
      contradictions: [],
      preserveAmbiguity: false,
      finalContent: selected.content,
    };
  }

  private detectContradictions(candidates: SynthesisCandidate[]): string[] {
    const contradictions: string[] = [];

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i].content.toLowerCase();
        const b = candidates[j].content.toLowerCase();

        if (isContradiction(a, b)) {
          contradictions.push(`${candidates[i].id} ↔ ${candidates[j].id}`);
        }

        if (this.isNegation(a, b)) {
          contradictions.push(`${candidates[i].id} Negates ${candidates[j].id}`);
        }
      }
    }

    return contradictions;
  }

  private isNegation(a: string, b: string): boolean {
    const negationPatterns = [
      { pos: /\byes\b/i, neg: /\bno\b/i },
      { pos: /\btrue\b/i, neg: /\bfalse\b/i },
      { pos: /\bsafe\b/i, neg: /\bunsafe\b/i },
      { pos: /\beffective\b/i, neg: /\bineffective\b/i },
      { pos: /\bpossible\b/i, neg: /\bimpossible\b/i },
    ];

    for (const { pos, neg } of negationPatterns) {
      if (pos.test(a) && neg.test(b)) return true;
      if (neg.test(a) && pos.test(b)) return true;
    }

    return false;
  }

  private formatConflict(contradictions: string[]): string {
    const conflicts = contradictions.slice(0, 3);
    const summary = conflicts.map(c => c.replace(/↔/g, "vs")).join(", ");
    return `Multiple conflicting views: ${summary}${contradictions.length > 3 ? "..." : ""}`;
  }

  private formatPartialAgreement(candidates: SynthesisCandidate[], contradictions: string[]): string {
    const top = candidates.slice(0, 2);
    const avgConfidence = top.reduce((sum, c) => sum + c.confidence, 0) / top.length;

    if (contradictions.length > 0) {
      return `PARTIAL: No clear consensus. Leading views: ${top.map(c => c.content.substring(0, 30)).join(" | ")}`;
    }

    return top[0]?.content;
  }

  private preserveTopCandidates(candidates: SynthesisCandidate[], contradictions: string[]): SynthesisCandidate[] {
    if (contradictions.length === 0) {
      return candidates.slice(0, 2);
    }

    const nonContradicting = candidates.filter(c => {
      for (const contra of contradictions) {
        if (contra.includes(c.id)) return false;
      }
      return true;
    });

    if (nonContradicting.length > 0) {
      return nonContradicting.slice(0, 2);
    }

    return candidates.slice(0, 2);
  }

  private hasStrongMajority(candidates: SynthesisCandidate[]): boolean {
    if (candidates.length < 2) return true;

    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
    const top = sorted[0].confidence;
    const second = sorted[1].confidence;

    return top - second > 0.3;
  }

  private calculateConfidence(result: TaskResult): number {
    const metrics = result.metrics;
    if (metrics.tokensUsed === 0) return 0.5;
    
    // Quality is primary: more tokens = more thorough reasoning
    const tokensScore = Math.min(1, metrics.tokensUsed / 4000);
    // Latency matters but isn't the primary factor
    const latencyScore = Math.min(1, metrics.latencyMs / 60000);
    // Cost reflects model capability (more expensive = usually better)
    const costScore = Math.min(1, metrics.cost / 0.5);
    
    // Quality weighted highest, then cost, then latency
    return (tokensScore * 0.5) + (costScore * 0.3) + (latencyScore * 0.2);
  }

  private strategyVoting(candidates: SynthesisCandidate[]): SynthesisCandidate {
    const grouped = new Map<string, { candidate: SynthesisCandidate; votes: number }>();
    
    for (const candidate of candidates) {
      const key = candidate.content.substring(0, 50).toLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        existing.votes++;
        existing.candidate.votes = existing.votes;
      } else {
        grouped.set(key, { candidate, votes: 1 });
      }
    }
    
    const sorted = Array.from(grouped.values())
      .sort((a, b) => b.votes - a.votes);
    
    return sorted[0]?.candidate ?? candidates[0];
  }

  private strategyRanking(candidates: SynthesisCandidate[]): SynthesisCandidate {
    return [...candidates].sort((a, b) => b.confidence - a.confidence)[0];
  }

  private strategyWeighted(candidates: SynthesisCandidate[]): SynthesisCandidate {
    return [...candidates].sort((a, b) => b.confidence * b.votes - a.confidence * a.votes)[0];
  }

  private strategyMerge(candidates: SynthesisCandidate[]): SynthesisCandidate {
    const merged = candidates.map(c => c.content).join("\n\n---\n\n");
    return {
      id: "merged",
      content: merged,
      agentId: "fuse",
      confidence: candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length,
      votes: 1,
    };
  }

  private async strategyMergeLLM(candidates: SynthesisCandidate[], signal?: AbortSignal): Promise<SynthesisCandidate> {
    if (!this.providerRouter) {
      return this.strategyMerge(candidates);
    }

    const provider = this.providerRouter.selectProvider({});
    if (!provider || !provider.isAvailable()) {
      return this.strategyMerge(candidates);
    }

    const prompt = `Merge the following candidate answers into a single coherent response.
Return a JSON with: content (merged answer), confidence (0-1).

Candidates:
${candidates.map((c, i) => `${i + 1}. ${c.content}`).join("\n")}`;

    try {
      const response = await provider.chat([
        { role: "system", content: getPrompt("fuse") },
        { role: "user", content: prompt },
      ], { signal });

      const parsed = JSON.parse(String(response.content));
      return {
        id: "llm-merged",
        content: parsed.content || this.strategyMerge(candidates).content,
        agentId: "fuse-llm",
        confidence: parsed.confidence ?? 0.7,
        votes: candidates.reduce((sum, c) => sum + c.votes, 0),
      };
    } catch {
      return this.strategyMerge(candidates);
    }
  }

  private handleNoCandidates(state: PipelineState): PipelineState {
    return {
      ...state,
      stage: "store",
      synthesis: {
        candidates: [],
        final: this.config.allowNoAnswer ? {
          content: "NO_CONSENSUS: No viable candidates to synthesize",
          confidence: 0,
          evidence: [],
        } : undefined,
      },
      updatedAt: Date.now(),
    };
  }
}
