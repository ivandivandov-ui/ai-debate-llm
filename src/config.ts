export interface Config {
  providers: ProviderConfig;
  agents: AgentConfig;
  debate: DebateConfig;
  a2a: A2AConfig;
  memory: MemoryConfig;
  observability: ObservabilityConfig;
}

export interface ProviderConfig {
  default: string;
  fallback: string;
  timeout: number;
  retryAttempts: number;
}

export interface AgentConfig {
  maxConcurrent: number;
  timeout: number;
  defaultTemperature: number;
  defaultMaxTokens: number;
}

export interface DebateConfig {
  maxRounds: number;
  minVerificationRate: number;
  enableLoop: boolean;
  convergenceThreshold: number;
}

export interface A2AConfig {
  turnLimit: {
    mode: "unlimited" | "fixed" | "adaptive";
    maxTurns: number;
  };
  costGuard: {
    mode: "no-limit" | "budget" | "auto";
    maxBudget: number;
    warnAt: number;
  };
  roleAccess: {
    mode: "open" | "role-restricted" | "explicit";
  };
}

export interface MemoryConfig {
  shortTermTTL: number;
  maxEntries: number;
  enableRetrieval: boolean;
}

export interface ObservabilityConfig {
  logLevel: "debug" | "info" | "warn" | "error";
  enableMetrics: boolean;
  enableTracing: boolean;
}

import * as fs from "fs";
import * as path from "path";

const CONFIG_DIR = path.join(__dirname, "..", "config");

export function loadConfig(): Config {
  const configs: Partial<Config> = {};

  try {
    const system = fs.readFileSync(path.join(CONFIG_DIR, "system.json"), "utf-8");
    configs.providers = JSON.parse(system).providers;
    configs.agents = JSON.parse(system).agents;
    configs.debate = JSON.parse(system).debate;
    configs.a2a = JSON.parse(system).a2a;
    configs.memory = JSON.parse(system).memory;
    configs.observability = JSON.parse(system).observability;
  } catch (e) {
    return getDefaultConfig();
  }

  return configs as Config;
}

export function getDefaultConfig(): Config {
  return {
    providers: {
      default: "openrouter",
      fallback: "google",
      timeout: 60000,
      retryAttempts: 3,
    },
    agents: {
      maxConcurrent: 10,
      timeout: 300000,
      defaultTemperature: 0.7,
      defaultMaxTokens: 4096,
    },
    debate: {
      maxRounds: 10,
      minVerificationRate: 0.7,
      enableLoop: true,
      convergenceThreshold: 0.9,
    },
    a2a: {
      turnLimit: { mode: "fixed", maxTurns: 10 },
      costGuard: { mode: "budget", maxBudget: 10, warnAt: 0.8 },
      roleAccess: { mode: "open" },
    },
    memory: {
      shortTermTTL: 3600000,
      maxEntries: 1000,
      enableRetrieval: true,
    },
    observability: {
      logLevel: "info",
      enableMetrics: true,
      enableTracing: false,
    },
  };
}

export function mergeConfig(base: Config, overrides: Partial<Config>): Config {
  return {
    providers: { ...base.providers, ...overrides.providers },
    agents: { ...base.agents, ...overrides.agents },
    debate: { ...base.debate, ...overrides.debate },
    a2a: { ...base.a2a, ...overrides.a2a },
    memory: { ...base.memory, ...overrides.memory },
    observability: { ...base.observability, ...overrides.observability },
  };
}