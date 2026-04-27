import { describe, it, expect, beforeEach } from "@jest/globals";
import { DebateOrchestrator } from "../../src/orchestration/debate-orchestrator";
import { SocraticProtocol, AdversarialProtocol, RedTeamProtocol, ConsensusProtocol } from "../../src/protocols/implementation";
import { createSynthesisEngine } from "../../src/synthesis/strategies/synthesis";
import { VerifierFactory } from "../../src/verification/verifier";

describe("DebateOrchestrator", () => {
  let orchestrator: DebateOrchestrator;

  beforeEach(() => {
    orchestrator = new DebateOrchestrator({ maxConcurrentSessions: 10, sessionTimeout: 60000 });
  });

  afterEach(() => {
    if (orchestrator) {
      orchestrator.destroy();
    }
  });

  it("should create orchestrator", () => {
    expect(orchestrator).toBeDefined();
  });

  it("should track sessions", () => {
    const sessions = orchestrator.getSessions();
    expect(sessions).toEqual([]);
  });
});

describe("Protocols", () => {
  it("should create SocraticProtocol", () => {
    const protocol = new SocraticProtocol();
    expect(protocol.name).toBe("socratic");
    expect(protocol.maxRounds).toBe(10);
  });

  it("should create AdversarialProtocol", () => {
    const protocol = new AdversarialProtocol();
    expect(protocol.name).toBe("adversarial");
    expect(protocol.maxRounds).toBe(8);
  });

  it("should create RedTeamProtocol", () => {
    const protocol = new RedTeamProtocol();
    expect(protocol.name).toBe("red-team");
    expect(protocol.maxRounds).toBe(6);
  });

  it("should create ConsensusProtocol", () => {
    const protocol = new ConsensusProtocol();
    expect(protocol.name).toBe("consensus");
    expect(protocol.maxRounds).toBe(5);
  });

  it("should get participants", () => {
    const protocol = new SocraticProtocol();
    const participants = protocol.getParticipants({} as any);
    expect(participants.length).toBe(3);
  });

  it("should decide next turn", () => {
    const protocol = new SocraticProtocol();
    const decision = protocol.getNextTurn({ round: 0, phase: "opening", history: [], proposals: [], positions: new Map() });
    expect(decision.suggestedAction).toBe("question");
  });
});

describe("SynthesisEngine", () => {
  it("should create engine with default config", () => {
    const engine = createSynthesisEngine();
    expect(engine).toBeDefined();
  });

  it("should synthesize with voting strategy", () => {
    const engine = createSynthesisEngine({ strategy: "voting" });
    
    const candidates = [
      { id: "1", content: "Option A", agentId: "agent-1" as any, confidence: 0.8, votes: 3 },
      { id: "2", content: "Option B", agentId: "agent-2" as any, confidence: 0.6, votes: 1 },
      { id: "3", content: "Option A", agentId: "agent-3" as any, confidence: 0.7, votes: 2 },
    ];

    const result = engine.synthesize(candidates as any);
    expect(result).toBeDefined();
    expect(result?.content).toContain("Option");
  });

  it("should synthesize with ranking strategy", () => {
    const engine = createSynthesisEngine({ strategy: "ranking" });
    
    const candidates = [
      { id: "1", content: "Best option", agentId: "agent-1" as any, confidence: 0.9, votes: 1 },
      { id: "2", content: "Second best", agentId: "agent-2" as any, confidence: 0.5, votes: 1 },
    ];

    const result = engine.synthesize(candidates as any);
    expect(result?.content).toBe("Best option");
  });

  it("should handle empty candidates", () => {
    const engine = createSynthesisEngine();
    const result = engine.synthesize([]);
    expect(result).toBeNull();
  });
});

describe("VerifierFactory", () => {
  it("should create factual verifier", () => {
    const verifier = VerifierFactory.createFactualVerifier();
    expect(verifier).toBeDefined();
  });

  it("should verify content", async () => {
    const verifier = VerifierFactory.createFactualVerifier();
    const result = await verifier.verify("Some content");
    expect(result.passed).toBe(true);
  });

  it("should detect empty content", async () => {
    const verifier = VerifierFactory.createFactualVerifier();
    const result = await verifier.verify("");
    expect(result.passed).toBe(false);
  });

  it("should create safety verifier", async () => {
    const verifier = VerifierFactory.createSafetyVerifier();
    const result = await verifier.verify("<script>alert(1)</script>");
    expect(result.passed).toBe(false);
  });

  it("should pass safe content", async () => {
    const verifier = VerifierFactory.createSafetyVerifier();
    const result = await verifier.verify("This is safe content");
    expect(result.passed).toBe(true);
  });
});

describe("Memory", () => {
  it("should store and retrieve short term memory", () => {
    const { shortTermMemory } = require("../../src/memory/short-term");
    shortTermMemory.set("session-1:key1", { value: "test" });
    const result = shortTermMemory.get("session-1:key1");
    expect(result).toEqual({ value: "test" });
  });

  it("should delete short term memory", () => {
    const { shortTermMemory } = require("../../src/memory/short-term");
    shortTermMemory.set("session-1:key1", "value");
    shortTermMemory.delete("session-1:key1");
    const result = shortTermMemory.get("session-1:key1");
    expect(result).toBeNull();
  });
});

describe("Observability", () => {
  it("should log messages", () => {
    const { logger } = require("../../src/observability/logging");
    logger.info("Test message", { context: "test" });
    const logs = logger.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].message).toBe("Test message");
  });

  it("should subscribe to logs", () => {
    const { logger } = require("../../src/observability/logging");
    const callback = jest.fn();
    const unsubscribe = logger.subscribe(callback);
    logger.info("New message");
    expect(callback).toHaveBeenCalled();
    unsubscribe();
  });

  it("should record metrics", () => {
    const { metrics } = require("../../src/observability/metrics");
    metrics.recordRequest(true, 1000, 500, 0.005);
    const collected = metrics.getMetrics();
    expect(collected.requestsTotal).toBe(1);
    expect(collected.requestsSuccess).toBe(1);
  });

  it("should calculate average latency", () => {
    const { MetricsCollector } = require("../../src/observability/metrics");
    const freshMetrics = new MetricsCollector();
    freshMetrics.recordRequest(true, 1000, 100, 0.001);
    freshMetrics.recordRequest(true, 2000, 100, 0.001);
    const collected = freshMetrics.getMetrics();
    expect(collected.avgLatencyMs).toBe(1500);
  });
});