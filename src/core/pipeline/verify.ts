import type { PipelineState, VerificationState, VerificationItem } from "../contracts/state";
import type { TaskResult } from "../contracts/task";
import { ProviderRouter } from "../../providers/router/provider-router";
import { isContradiction } from "../../utils/contradictions";
import { getPrompt } from "./prompts";

export interface VerificationResult {
  passed: boolean;
  confidence: number;
  errors: string[];
  metadata?: Record<string, unknown>;
}

export interface VerifyStageConfig {
  verifyFactual: boolean;
  verifyLogical: boolean;
  verifyConsistency: boolean;
  verifySafety: boolean;
  minConfidence: number;
  enableCrossReference: boolean;
  failFastOnSafety: boolean;
  useLLM: boolean;
}

export class VerifyStage {
  private config: VerifyStageConfig;
  private providerRouter?: ProviderRouter;

  constructor(config?: Partial<VerifyStageConfig>) {
    this.config = {
      verifyFactual: true,
      verifyLogical: true,
      verifyConsistency: true,
      verifySafety: true,
      minConfidence: 0.5,
      enableCrossReference: true,
      failFastOnSafety: true,
      useLLM: false, // Enable for smarter verification
      ...config,
    };
  }

  setProviderRouter(router: ProviderRouter): void {
    this.providerRouter = router;
  }

  async execute(state: PipelineState, signal?: AbortSignal): Promise<PipelineState> {
    if (signal?.aborted) throw new Error("ABORTED");
    const verification: VerificationState = {
      pending: [],
      verified: [],
      failed: [],
    };

    for (const result of state.results) {
      if (!result.success) {
        verification.pending.push({
          id: result.taskId,
          content: result.error ?? "Unknown error",
          type: "safety",
          status: "pending",
        });
        continue;
      }

      const content = String(result.output ?? "");

      if (this.config.verifyFactual) {
        verification.pending.push({
          id: `${result.taskId}-factual`,
          content,
          type: "factual",
          status: "pending",
        });
      }

      if (this.config.verifyLogical) {
        verification.pending.push({
          id: `${result.taskId}-logical`,
          content,
          type: "logical",
          status: "pending",
        });
      }

      if (this.config.verifyConsistency) {
        verification.pending.push({
          id: `${result.taskId}-consistency`,
          content,
          type: "consistency",
          status: "pending",
        });
      }

      if (this.config.verifySafety) {
        verification.pending.push({
          id: `${result.taskId}-safety`,
          content,
          type: "safety",
          status: "pending",
        });
      }
    }

    let verified = await this.runVerifications(verification.pending, state, signal);

    if (this.config.enableCrossReference) {
      verified = this.crossReference(verified, state);
    }

    const hasFatalFailure = verified.failed.some(
      f => f.type === "safety" && this.config.failFastOnSafety
    );

    if (hasFatalFailure) {
      verified.pending = [];
      verified.failed.forEach(f => {
        if (f.type !== "safety") {
          verified.verified.push(f);
        }
      });
      verified.failed = verified.failed.filter(f => f.type === "safety");
    }

    return {
      ...state,
      verification: verified,
      history: [
        ...state.history,
        {
          stage: "verify",
          timestamp: Date.now(),
          input: `${state.results.length} results`,
          output: `verified: ${verified.verified.length}, failed: ${verified.failed.length}`,
        },
      ],
      updatedAt: Date.now(),
    };
  }

  private async runVerifications(
    items: VerificationItem[],
    state: PipelineState,
    signal?: AbortSignal
  ): Promise<VerificationState> {
    const verified: VerificationItem[] = [];
    const failed: VerificationItem[] = [];

    for (const item of items) {
      if (signal?.aborted) throw new Error("ABORTED");
      const result = await this.verifyItem(item, state, signal);
      
      if (result.passed || result.confidence >= this.config.minConfidence) {
        verified.push({
          ...item,
          status: "passed",
          errors: result.errors,
        });
      } else {
        failed.push({
          ...item,
          status: "failed",
          errors: result.errors,
        });
      }

      if (this.config.failFastOnSafety && item.type === "safety" && !result.passed) {
        break;
      }
    }

    return { pending: [], verified, failed };
  }

  private async verifyItem(
    item: VerificationItem,
    state: PipelineState,
    signal?: AbortSignal
  ): Promise<VerificationResult> {
    // Use LLM for smarter verification if available
    if (this.config.useLLM && this.providerRouter) {
      return this.verifyWithLLM(item.content, item.type, state, signal);
    }

    switch (item.type) {
      case "factual":
        return this.verifyFactual(item.content, state);
      case "logical":
        return this.verifyLogical(item.content, state);
      case "consistency":
        return this.verifyConsistency(item.content, state);
      case "safety":
        return this.verifySafety(item.content);
      default:
        return { passed: true, confidence: 1, errors: [] };
    }
  }

  private async verifyWithLLM(content: string, type: string, state: PipelineState, signal?: AbortSignal): Promise<VerificationResult> {
    if (!this.providerRouter) {
      return { passed: false, confidence: 0, errors: ["No provider router"] };
    }

    const provider = this.providerRouter.selectProvider({});
    if (!provider || !provider.isAvailable()) {
      return this.verifyFactual(content, state);
    }

    const prompt = `You are a verification expert. Analyze the following ${type} claim and determine if it is accurate.
Return a JSON with: passed (boolean), confidence (0-1), errors (array of issues found).

Claim: """${content}"""

Previous results for context: ${state.results.slice(0, 3).map(r => String(r.output)).join(" | ")}`;

    try {
      const response = await provider.chat([
        { role: "system", content: getPrompt("verification") },
        { role: "user", content: prompt },
      ], { signal });

      const parsed = JSON.parse(String(response.content));
      return {
        passed: parsed.passed ?? true,
        confidence: parsed.confidence ?? 0.5,
        errors: parsed.errors ?? [],
      };
    } catch {
      // Fallback to regex-based verification
      return this.verifyFactual(content, state);
    }
  }

  private verifyFactual(content: string, state: PipelineState): VerificationResult {
    const errors: string[] = [];
    let confidence = 1;

    if (!content || content.trim().length === 0) {
      errors.push("Content is empty");
      return { passed: false, confidence: 0, errors };
    }

    if (content.length < 10) {
      errors.push("Content too short for factual verification");
      confidence *= 0.5;
    }

    const hasQuantifiableClaims = /\d+%|\$\d+|\d+\s+(year|month|day|hour)/i.test(content);
    if (hasQuantifiableClaims) {
      confidence *= 0.8;
    }

    const hasHedging = /\bmaybe\b|\bpossibly\b|\bmight\b|\bcould\b/i.test(content);
    if (hasHedging) {
      confidence *= 0.9;
    }

    const hasAbsoluteTerms = /\b(always|never|everyone|nobody)\b/i.test(content);
    if (hasAbsoluteTerms) {
      errors.push("Absolute terms detected - may be overgeneralization");
      confidence *= 0.7;
    }

    const previousResults = state.results.map(r => String(r.output).toLowerCase());
    const contentLower = content.toLowerCase();
    
    for (const prev of previousResults) {
      if (prev !== contentLower && isContradiction(contentLower, prev)) {
        errors.push("Contradicts previous result");
        confidence *= 0.3;
      }
    }

    return {
      passed: errors.length === 0,
      confidence,
      errors,
      metadata: { hasQuantifiableClaims, hasHedging, hasAbsoluteTerms },
    };
  }

  private verifyLogical(content: string, state: PipelineState): VerificationResult {
    const errors: string[] = [];
    let confidence = 0.8;

    const logicalIndicators = /\b(because|therefore|thus|hence|so|consequently)\b/i;
    if (!logicalIndicators.test(content)) {
      confidence -= 0.2;
    }

    const causalPatterns = /if\s+\w+\s+then|(\w+)\s+leads\s+to|(\w+)\s+causes/i;
    if (causalPatterns.test(content)) {
      const hasBecause = content.toLowerCase().includes("because");
      if (!hasBecause) {
        errors.push("Causal claim without justification");
        confidence *= 0.6;
      }
    }

    const circularPatterns = /(.+)\s+means\s+(.+)\s+therefore\s+(\1)/gi;
    if (circularPatterns.test(content)) {
      errors.push("Circular reasoning detected");
      confidence *= 0.2;
    }

    const hasQuestion = content.includes("?");
    if (hasQuestion) {
      errors.push("Question in answer - not a conclusion");
      confidence *= 0.5;
    }

    return {
      passed: errors.length === 0 && confidence >= this.config.minConfidence,
      confidence,
      errors,
    };
  }

  private verifyConsistency(content: string, state: PipelineState): VerificationResult {
    const errors: string[] = [];
    let confidence = 1;

    // Check against previous results instead of synthesis (which is populated later)
    if (state.results.length > 0) {
      const firstResult = state.results[0]?.output?.toString().toLowerCase() ?? "";
      const currentContent = content.toLowerCase();

      if (firstResult && currentContent) {
        const similarity = this.calculateSimilarity(firstResult, currentContent);
        
        if (similarity < 0.3) {
          errors.push("Major deviation from primary hypothesis");
          confidence *= 0.5;
        } else if (similarity < 0.7) {
          confidence *= 0.8;
        }
      }
    }

    const hasNumbers = /\d+/.test(content);
    if (hasNumbers) {
      const otherContents = state.results.map(r => String(r.output));
      for (const other of otherContents) {
        const numsInOther = other.match(/\d+/g) || ([] as string[]);
        const numsInCurrent = content.match(/\d+/g) || ([] as string[]);
        
        for (const num of numsInCurrent) {
          if (!numsInOther.includes(num)) {
            errors.push(`Number ${num} not in any other source`);
            confidence *= 0.7;
            break;
          }
        }
      }
    }

    return {
      passed: errors.length === 0,
      confidence,
      errors,
    };
  }

  private verifySafety(content: string): VerificationResult {
    const errors: string[] = [];
    let confidence = 1;

    const dangerousPatterns = [
      { pattern: /<script/i, error: "XSS: script tag" },
      { pattern: /javascript:/i, error: "XSS: javascript protocol" },
      { pattern: /on\w+=/i, error: "XSS: event handler" },
      { pattern: /eval\s*\(/i, error: "Code injection: eval" },
      { pattern: /innerHTML\s*=/i, error: "XSS: innerHTML" },
      { pattern: /\bexec\s*\(/i, error: "Code injection: exec" },
      { pattern: /\bimport\s+.*\beval\b/i, error: "Code injection: dynamic import" },
      { pattern: /\bSQL\s+injection\b/i, error: "SQL injection reference" },
      { pattern: /rm\s+-rf/i, error: "Destructive command" },
      { pattern: /\bkill\s+-9\b/i, error: "Force kill command" },
    ];

    for (const { pattern, error } of dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push(error);
        confidence *= 0.1;
      }
    }

    const suspiciousDomains = [
      "evil.com",
      "phishing",
      "malware",
      "hacked",
    ];

    for (const domain of suspiciousDomains) {
      if (content.toLowerCase().includes(domain)) {
        errors.push(`Suspicious content: ${domain}`);
        confidence *= 0.5;
      }
    }

    return {
      passed: errors.length === 0,
      confidence,
      errors,
    };
  }

  private crossReference(
    verification: VerificationState,
    state: PipelineState
  ): VerificationState {
    const allContent = [
      ...verification.verified.map(v => v.content),
      ...verification.failed.map(f => f.content),
      ...state.results.map(r => String(r.output)),
    ];

    const failedForCrossRef: VerificationItem[] = [];
    
    verification.verified = verification.verified.filter(v => {
      const matches = allContent.filter(c => 
        this.calculateSimilarity(v.content, c) > 0.5 // Lower threshold
      );

      // Need at least 2 similar items (was 3 - too aggressive)
      if (matches.length >= 2) {
        return true;
      }

      // Move to failed only if there's very little support
      failedForCrossRef.push({
        ...v,
        errors: [...(v.errors || []), "Insufficient cross-reference support"],
        status: "failed",
      });
      return false;
    });

    // Add failed items to verification.failed
    verification.failed = [...verification.failed, ...failedForCrossRef];

    return verification;
  }

  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }
}