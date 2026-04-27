import type { AgentRole } from "../core/contracts/message";

export interface ModelMapping {
  preferred: string[];
  fallbacks: string[];
}

export const ROLE_MODEL_MAPPING: Record<AgentRole | "default", ModelMapping> = {
  builder: {
    preferred: ["gemini-1.5-pro", "claude-3-5-sonnet", "gpt-4-turbo"],
    fallbacks: ["gemini-1.5-flash", "claude-3-haiku", "gpt-3.5-turbo"]
  },
  scientist: {
    preferred: ["gemini-1.5-pro", "claude-3-5-sonnet", "gpt-4-turbo"],
    fallbacks: ["gemini-1.5-flash", "claude-3-haiku", "gpt-3.5-turbo"]
  },
  critic: {
    preferred: ["claude-3-5-sonnet", "llama-3-70b-instruct", "gpt-4"],
    fallbacks: ["claude-3-haiku", "llama-3-8b-instruct"]
  },
  skeptic: {
    preferred: ["gemini-1.5-flash", "claude-3-haiku", "gpt-3.5-turbo"],
    fallbacks: ["llama-3-8b-instruct"]
  },
  verifier: {
    preferred: ["gemini-1.5-flash", "llama-3.1-8b-instant"],
    fallbacks: ["gpt-4o-mini", "claude-3-haiku"]
  },
  judge: {
    preferred: ["gpt-4o", "claude-3.5-sonnet", "gemini-1.5-pro"],
    fallbacks: ["llama-3.1-70b-versatile"]
  },
  default: {
    preferred: ["gemini-1.5-flash"],
    fallbacks: ["gpt-4o-mini"]
  }
};

/**
 * Returns the best available model for a given role from a provider.
 */
export function getBestModel(role: AgentRole, availableModels: string[]): string {
  const mapping = ROLE_MODEL_MAPPING[role] || ROLE_MODEL_MAPPING.default;
  
  // 1. Try preferred
  for (const pref of mapping.preferred) {
    const found = availableModels.find(m => m.toLowerCase().includes(pref.toLowerCase()));
    if (found) return found;
  }
  
  // 2. Try fallbacks
  for (const fb of mapping.fallbacks) {
    const found = availableModels.find(m => m.toLowerCase().includes(fb.toLowerCase()));
    if (found) return found;
  }
  
  // 3. Just return first available
  return availableModels[0] || "default";
}
