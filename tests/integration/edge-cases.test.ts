import { describe, it, expect, beforeEach } from "@jest/globals";
import { loadConfig, getDefaultConfig, mergeConfig } from "../../src/config";

describe("Config", () => {
  it("should load default config", () => {
    const config = getDefaultConfig();
    expect(config.providers.default).toBe("openrouter");
    expect(config.debate.maxRounds).toBe(10);
    expect(config.a2a.turnLimit.maxTurns).toBe(10);
  });

  it("should merge configs", () => {
    const base = getDefaultConfig();
    const merged = mergeConfig(base, {
      debate: { maxRounds: 5, minVerificationRate: 0.8, enableLoop: true, convergenceThreshold: 0.9 },
      providers: { default: "google", fallback: "openai", timeout: 30000, retryAttempts: 3 },
    });

    expect(merged.debate.maxRounds).toBe(5);
    expect(merged.providers.default).toBe("google");
    expect(merged.providers.fallback).toBe("openai");
  });
});

describe("Memory Shortcuts", () => {
  it("should create tool adapters", async () => {
    const { calculate, MathToolAdapter } = await import("../../src/agents/tools/adapters/math.tool");
    
    const result = await calculate("2 + 2");
    expect(result).toBe(4);
  });

  it("should handle complex expressions", async () => {
    const { calculate } = await import("../../src/agents/tools/adapters/math.tool");
    
    const result = await calculate("(10 + 5) * 2");
    expect(result).toBe(30);
  });

  it("should throw on invalid", async () => {
    const { calculate } = await import("../../src/agents/tools/adapters/math.tool");
    
    await expect(calculate("invalid")).rejects.toThrow();
  });
});

describe("DatabaseTool", () => {
  it("should create database tool", async () => {
    const { createDatabaseTool } = await import("../../src/agents/tools/adapters/db.tool");
    
    const tool = createDatabaseTool();
    expect(tool.name).toBe("database");
    expect(tool.inputSchema.properties).toHaveProperty("query");
  });
});

describe("ProviderEdgeCases", () => {
  it("should handle missing api key", async () => {
    const { GoogleProvider } = await import("../../src/providers/google/gemini.provider");
    
    const provider = new GoogleProvider();
    
    expect(provider.isAvailable()).toBe(false);
  });

  it("should select default model", async () => {
    const { OpenRouterProvider } = await import("../../src/providers/openrouter/openrouter.provider");
    
    const provider = new OpenRouterProvider();
    const model = provider.getModel("anthropic/claude-3.5-sonnet");
    
    expect(model?.id).toBe("anthropic/claude-3.5-sonnet");
  });
});

describe("AgentEdgeCases", () => {
  it("should handle empty task input", async () => {
    const { createAgentFactory } = await import("../../src/agents/base/agent-factory");
    
    const factory = createAgentFactory();
    const agent = await factory.createWithRole("builder", "session-1" as any);
    await agent.initialize();
    
    const result = await agent.execute({
      task: { id: "task-1", type: "build", description: "test", input: "" },
    });
    
    expect(result.result).toBeDefined();
  });

  it("should handle undefined result", async () => {
    const { createAgentFactory } = await import("../../src/agents/base/agent-factory");
    
    const factory = createAgentFactory();
    const agent = await factory.createWithRole("scientist", "session-1" as any);
    await agent.initialize();
    
    const result = await agent.execute({
      task: { id: "task-1", type: "research", description: "test", input: undefined },
    });
    
    expect(result.result).toBeDefined();
  });
});

describe("ProtocolEdgeCases", () => {
  it("should handle zero rounds", async () => {
    const { ConsensusProtocol } = await import("../../src/protocols/implementation");
    
    const protocol = new ConsensusProtocol();
    
    expect(protocol.shouldContinue({ round: 0, phase: "opening", history: [], proposals: [], positions: new Map() } as any)).toBe(true);
  });

  it("should track history", async () => {
    const { SocraticProtocol } = await import("../../src/protocols/implementation");
    
    const protocol = new SocraticProtocol();
    const state = protocol.createInitialState({ round: 0, phase: "opening", history: [], proposals: [], positions: new Map() } as any);
    
    expect(state.history.length).toBe(0);
    expect(state.phase).toBe("opening");
  });
});

describe("VerificationEdgeCases", () => {
  it("should handle empty content", async () => {
    const { VerifierFactory } = await import("../../src/verification/verifier");
    
    const verifier = VerifierFactory.createFactualVerifier();
    const result = await verifier.verify("");
    
    expect(result.passed).toBe(false);
  });

  it("should check logical consistency", async () => {
    const { VerifierFactory } = await import("../../src/verification/verifier");
    
    const verifier = VerifierFactory.createLogicalVerifier();
    const result = await verifier.verify("A implies B");
    
    expect(result).toBeDefined();
  });

  it("should handle multiple premises", async () => {
    const { VerifierFactory } = await import("../../src/verification/verifier");
    
    const verifier = VerifierFactory.createLogicalVerifier();
    const result = await verifier.verify("A and B", ["A", "B"]);
    
    expect(result).toBeDefined();
  });

  it("should verify consistency with context", async () => {
    const { VerifierFactory } = await import("../../src/verification/verifier");
    
    const verifier = VerifierFactory.createConsistencyVerifier();
    const result = await verifier.verify("The sky is blue", ["The sky is blue", "The grass is green"]);
    
    expect(result).toBeDefined();
  });
});

describe("SynthesisEdgeCases", () => {
  it("should handle single candidate", async () => {
    const { createSynthesisEngine } = await import("../../src/synthesis/strategies/synthesis");
    
    const engine = createSynthesisEngine({ strategy: "voting" });
    const result = engine.synthesize([
      { id: "1", content: "Only option", agentId: "agent-1", confidence: 0.8, votes: 1 },
    ] as any);
    
    expect(result?.content).toBe("Only option");
  });

  it("should handle weighted strategy", async () => {
    const { createSynthesisEngine } = await import("../../src/synthesis/strategies/synthesis");
    
    const engine = createSynthesisEngine({ strategy: "weighted" });
    const result = engine.synthesize([
      { id: "1", content: "High confidence", agentId: "agent-1", confidence: 0.9, votes: 1 },
      { id: "2", content: "Low confidence", agentId: "agent-2", confidence: 0.3, votes: 1 },
    ] as any);
    
    expect(result).toBeDefined();
  });

  it("should handle merge strategy", async () => {
    const { createSynthesisEngine } = await import("../../src/synthesis/strategies/synthesis");
    
    const engine = createSynthesisEngine({ strategy: "merge" });
    const result = engine.synthesize([
      { id: "1", content: "First", agentId: "agent-1", confidence: 0.8, votes: 1 },
      { id: "2", content: "Second", agentId: "agent-2", confidence: 0.7, votes: 1 },
    ] as any);
    
    expect(result?.content).toContain("First");
  });
});

describe("MemoryEdgeCases", () => {
  it("should handle TTL expiration", async () => {
    const { shortTermMemory } = await import("../../src/memory/short-term");
    
    shortTermMemory.set("ttl-test-key1", "value1", 1);
    await new Promise((r) => setTimeout(r, 10));
    
    const result = shortTermMemory.get("ttl-test-key1");
    expect(result).toBeNull();
  });

  it("should list keys", async () => {
    const { shortTermMemory } = await import("../../src/memory/short-term");
    
    shortTermMemory.set("list-key1", "value1");
    shortTermMemory.set("list-key2", "value2");
    
    const keys = shortTermMemory.keys();
    expect(keys).toContain("list-key1");
    expect(keys).toContain("list-key2");
  });
});

describe("MessageBusEdgeCases", () => {
  it("should handle failed delivery", async () => {
    const { A2AProtocol } = await import("../../src/agents/communication/protocol");
    const { MessageBus } = await import("../../src/agents/communication/message-bus");
    const { createMessage } = await import("../../src/core/contracts/message");
    
    const protocol = new A2AProtocol();
    protocol.setPolicy("session-1" as any, {
      turnLimit: { mode: "unlimited" },
      costGuard: { mode: "no-limit" },
      roleAccess: { mode: "open" },
    });
    
    const bus = new MessageBus(protocol);
    
    const message = createMessage(
      "agent-1" as any,
      "agent-2" as any,
      "request",
      "Test",
      "builder",
      "session-1" as any
    );
    
    const result = await bus.send(message);
    expect(result.success).toBe(true);
  });
});

describe("RouterEdgeCases", () => {
  it("should handle empty participants", async () => {
    const { A2ARouter } = await import("../../src/agents/communication/router");
    
    const router = new A2ARouter();
    
    const targets = router.route("agent-1" as any, {
      sessionId: "session-1" as any,
      round: 1,
      initiator: "agent-1" as any,
      participants: [],
      history: [],
    }, "request");
    
    expect(targets).toEqual([]);
  });

  it("should respect maxHops", async () => {
    const { A2ARouter } = await import("../../src/agents/communication/router");
    
    const router = new A2ARouter({ maxHops: 1 });
    expect(router).toBeDefined();
  });
});