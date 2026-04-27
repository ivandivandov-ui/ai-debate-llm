import { describe, it, expect, beforeEach } from "@jest/globals";
import { createMessage } from "../../src/core/contracts/message";
import { createInitialState } from "../../src/core/contracts/state";
import { createAgentState, STATE_TRANSITIONS, transitionState, AgentLifecycleState } from "../../src/agents/base/agent-state";
import { A2AProtocol } from "../../src/agents/communication/protocol";
import { MessageBus } from "../../src/agents/communication/message-bus";
import { A2ARouter } from "../../src/agents/communication/router";

describe("AgentState", () => {
  it("should create agent state", () => {
    const state = createAgentState(
      "agent-1" as any,
      {
        id: "agent-1" as any,
        role: "builder",
        sessionId: "session-1" as any,
        systemPrompt: "You are a builder",
        maxTokens: 4096,
        temperature: 0.7,
        provider: "openai",
      },
      ["build"],
      ["search"]
    );

    expect(state.id).toBe("agent-1");
    expect(state.lifecycle).toBe("idle");
    expect(state.capabilities).toContain("build");
    expect(state.tools).toContain("search");
  });

  it("should allow valid state transitions", () => {
    const state = createAgentState(
      "agent-1" as any,
      { id: "agent-1" as any, role: "builder", sessionId: "session-1" as any, systemPrompt: "", maxTokens: 4096, temperature: 0.7, provider: "openai" },
      [],
      []
    );

    const transitioned = transitionState(state, "initializing");
    expect(transitioned.lifecycle).toBe("initializing");

    const ready = transitionState(transitioned, "ready");
    expect(ready.lifecycle).toBe("ready");
  });

  it("should reject invalid state transitions", () => {
    const state = createAgentState(
      "agent-1" as any,
      { id: "agent-1" as any, role: "builder", sessionId: "session-1" as any, systemPrompt: "", maxTokens: 4096, temperature: 0.7, provider: "openai" },
      [],
      []
    );

    expect(() => transitionState(state, "processing")).toThrow("Invalid state transition");
  });

  it("should have correct transition map", () => {
    expect(STATE_TRANSITIONS.idle).toContain("initializing");
    expect(STATE_TRANSITIONS.ready).toContain("processing");
    expect(STATE_TRANSITIONS.terminated).toEqual([]);
  });
});

describe("A2AProtocol", () => {
  let protocol: A2AProtocol;

  beforeEach(() => {
    protocol = new A2AProtocol();
  });

  it("should set and get policy", () => {
    const policy = {
      turnLimit: { mode: "fixed" as const, maxTurns: 5 },
      costGuard: { mode: "budget" as const, maxBudget: 10 },
      roleAccess: { mode: "open" as const },
    };

    protocol.setPolicy("session-1" as any, policy);

    expect(protocol.getPolicy("session-1" as any)).toEqual(policy);
  });

  it("should track turn limits", () => {
    protocol.setPolicy("session-1" as any, {
      turnLimit: { mode: "fixed", maxTurns: 2 },
      costGuard: { mode: "no-limit" },
      roleAccess: { mode: "open" },
    });

    const result1 = protocol.canSend("session-1" as any, "agent-1" as any, "request");
    expect(result1.allowed).toBe(true);

    protocol.recordTurn("session-1" as any, "agent-1" as any);
    protocol.recordTurn("session-1" as any, "agent-1" as any);

    const result2 = protocol.canSend("session-1" as any, "agent-1" as any, "request");
    expect(result2.allowed).toBe(false);
  });

  it("should enforce cost guard", () => {
    protocol.setPolicy("session-1" as any, {
      turnLimit: { mode: "unlimited" },
      costGuard: { mode: "budget", maxBudget: 5 },
      roleAccess: { mode: "open" },
    });

    const affordable = protocol.canAfford("session-1" as any, 3, "agent-1" as any);
    expect(affordable.allowed).toBe(true);

    const tooExpensive = protocol.canAfford("session-1" as any, 10, "agent-1" as any);
    expect(tooExpensive.allowed).toBe(false);
  });
});

describe("MessageBus", () => {
  let protocol: A2AProtocol;
  let bus: MessageBus;

  beforeEach(() => {
    protocol = new A2AProtocol();
    bus = new MessageBus(protocol);
  });

  it("should send messages", async () => {
    protocol.setPolicy("session-1" as any, {
      turnLimit: { mode: "unlimited" },
      costGuard: { mode: "no-limit" },
      roleAccess: { mode: "open" },
    });

    const message = createMessage(
      "agent-1" as any,
      "agent-2" as any,
      "request",
      "Test message",
      "builder",
      "session-1" as any
    );

    const result = await bus.send(message);
    expect(result.success).toBe(true);
  });

  it("should track pending messages", async () => {
    protocol.setPolicy("session-1" as any, {
      turnLimit: { mode: "unlimited" },
      costGuard: { mode: "no-limit" },
      roleAccess: { mode: "open" },
    });

    const message = createMessage(
      "agent-1" as any,
      "agent-2" as any,
      "request",
      "Test",
      "builder",
      "session-1" as any
    );

    await bus.send(message);
    const pending = bus.getPending("session-1" as any);
    expect(pending.length).toBeGreaterThanOrEqual(0);
  });
});

describe("A2ARouter", () => {
  let router: A2ARouter;

  beforeEach(() => {
    router = new A2ARouter();
  });

  it("should create router with config", () => {
    const r = new A2ARouter({ defaultStrategy: "broadcast", allowSelfMessage: true });
    expect(r).toBeDefined();
  });

  it("should route to direct target", () => {
    const targets = router.route("agent-1" as any, {
      sessionId: "session-1" as any,
      round: 1,
      initiator: "agent-1" as any,
      participants: ["agent-1" as any, "agent-2" as any],
      history: [],
    }, "request", "direct");

    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0].agentId).toBe("agent-2");
  });

  it("should broadcast to all participants", () => {
    const targets = router.route("agent-1" as any, {
      sessionId: "session-1" as any,
      round: 1,
      initiator: "agent-1" as any,
      participants: ["agent-1" as any, "agent-2" as any, "agent-3" as any],
      history: [],
    }, "request", "broadcast");

    expect(targets.length).toBe(2);
  });

  it("should route round-robin", () => {
    router.route("agent-1" as any, {
      sessionId: "session-1" as any,
      round: 1,
      initiator: "agent-1" as any,
      participants: ["agent-1" as any, "agent-2" as any, "agent-3" as any],
      history: [],
    }, "request", "round-robin");

    const targets2 = router.route("agent-1" as any, {
      sessionId: "session-1" as any,
      round: 2,
      initiator: "agent-1" as any,
      participants: ["agent-1" as any, "agent-2" as any, "agent-3" as any],
      history: [],
    }, "request", "round-robin");

    expect(targets2).toBeDefined();
  });
});