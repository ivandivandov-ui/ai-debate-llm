import { describe, it, expect, beforeEach } from "@jest/globals";
import { DebateEngine } from "../../src/core/engine";
import { createInitialState, PipelineState } from "../../src/core/contracts/state";
import { DebateRequest } from "../../src/core/contracts/request";

describe("DebateEngine", () => {
  let engine: DebateEngine;

  beforeEach(() => {
    engine = new DebateEngine({ maxRounds: 3, timeout: 60000 });
  });

  it("should create engine with default config", () => {
    expect(engine).toBeDefined();
  });

  it("should create engine with custom config", () => {
    const custom = new DebateEngine({ maxRounds: 5, timeout: 120000 });
    expect(custom).toBeDefined();
  });
});

describe("PipelineState", () => {
  it("should create initial state", () => {
    const request: DebateRequest = { id: "1", query: "test query" };
    const state = createInitialState(request, "session-1");

    expect(state.sessionId).toBe("session-1");
    expect(state.stage).toBe("input");
    expect(state.round).toBe(0);
    expect(state.isComplete).toBe(false);
  });

  it("should have empty tasks and results initially", () => {
    const request: DebateRequest = { id: "1", query: "test" };
    const state = createInitialState(request, "session-1");

    expect(state.tasks).toEqual([]);
    expect(state.results).toEqual([]);
  });
});

describe("InputStage", () => {
  it("should reject empty query", async () => {
    const { InputStage } = await import("../../src/core/pipeline/input");
    const stage = new InputStage();
    const request: DebateRequest = { id: "1", query: "" };
    const initial = createInitialState(request, "session-1");

    await expect(stage.execute(initial)).rejects.toThrow("EMPTY_QUERY");
  });

  it("should accept valid query", async () => {
    const { InputStage } = await import("../../src/core/pipeline/input");
    const stage = new InputStage();
    const request: DebateRequest = { id: "1", query: "What is AI?" };
    const initial = createInitialState(request, "session-1");

    const result = await stage.execute(initial);

    expect(result.stage).toBe("decompose");
  });
});

describe("DecomposeStage", () => {
  it("should create tasks from query", async () => {
    const { DecomposeStage } = await import("../../src/core/pipeline/decompose");
    const stage = new DecomposeStage();
    const request: DebateRequest = { id: "1", query: "Build a neural network" };
    const state = createInitialState(request, "session-1");
    state.stage = "decompose";

    const result = await stage.execute(state);

    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.tasks.some((t) => t.type === "build")).toBe(true);
  });
});

describe("VerifyStage", () => {
  it("should verify successful results", async () => {
    const { VerifyStage } = await import("../../src/core/pipeline/verify");
    const stage = new VerifyStage();
    const request: DebateRequest = { id: "1", query: "test" };
    const state = createInitialState(request, "session-1");
    state.stage = "verify";
    state.results = [
      {
        taskId: "task-1",
        success: true,
        output: "test output",
        metrics: { tokensUsed: 100, latencyMs: 1000, cost: 0.001, provider: "test" },
      },
    ];

    const result = await stage.execute(state);

    expect(result.verification.verified.length).toBeGreaterThan(0);
  });

  it("should handle failed results", async () => {
    const { VerifyStage } = await import("../../src/core/pipeline/verify");
    const stage = new VerifyStage();
    const request: DebateRequest = { id: "1", query: "test" };
    const state = createInitialState(request, "session-1");
    state.stage = "verify";
    state.results = [
      {
        taskId: "task-1",
        success: false,
        error: "Something went wrong",
        metrics: { tokensUsed: 0, latencyMs: 0, cost: 0, provider: "test" },
      },
    ];

    const result = await stage.execute(state);

    expect(result.verification.failed.length).toBeGreaterThan(0);
  });
});

describe("DecisionStage", () => {
  it("should transition to fuse when complete", async () => {
    const { DecisionStage } = await import("../../src/core/pipeline/decision");
    const stage = new DecisionStage({ enableLoop: false });
    const request: DebateRequest = { id: "1", query: "test" };
    const state = createInitialState(request, "session-1");
    state.stage = "decision";
    state.round = 1;
    state.verification = { pending: [], verified: [], failed: [] };

    const result = await stage.execute(state);

    expect(result.stage).toBe("fuse");
  });

  it("should loop back when verification failed", async () => {
    const { DecisionStage } = await import("../../src/core/pipeline/decision");
    const stage = new DecisionStage({ maxRounds: 10, enableLoop: true });
    const request: DebateRequest = { id: "1", query: "test" };
    const state = createInitialState(request, "session-1");
    state.stage = "decision";
    state.round = 0;
    state.verification = { pending: [], verified: [], failed: [{ id: "1", content: "error", type: "factual", status: "failed" }] };

    const result = await stage.execute(state);

    expect(result.stage).toBe("dispatch");
    expect(result.round).toBe(1);
  });
});

describe("FuseStage", () => {
  it("should create candidates from results", async () => {
    const { FuseStage } = await import("../../src/core/pipeline/fuse");
    const stage = new FuseStage();
    const request: DebateRequest = { id: "1", query: "test" };
    const state = createInitialState(request, "session-1");
    state.stage = "fuse";
    state.results = [
      {
        taskId: "task-1",
        success: true,
        output: "Result 1",
        metrics: { tokensUsed: 100, latencyMs: 1000, cost: 0.001, provider: "test" },
      },
      {
        taskId: "task-2",
        success: true,
        output: "Result 2",
        metrics: { tokensUsed: 100, latencyMs: 1000, cost: 0.001, provider: "test" },
      },
    ];

    const result = await stage.execute(state);

    expect(result.synthesis.candidates.length).toBeGreaterThan(0);
  });
});