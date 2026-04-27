import { describe, it, expect, beforeEach } from "@jest/globals";
import { RateLimiter, createRateLimiter } from "../../src/utils/rate-limiter";
import { Cache, createCache } from "../../src/utils/cache";
import { DebateError, ProviderError, TimeoutError, ValidationError, isDebateError, formatError } from "../../src/utils/errors";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = createRateLimiter({ windowMs: 1000, maxRequests: 2 });
  });

  it("should allow requests within limit", () => {
    expect(limiter.isAllowed("user1")).toBe(true);
    expect(limiter.isAllowed("user1")).toBe(true);
  });

  it("should block requests over limit", () => {
    limiter.isAllowed("user1");
    limiter.isAllowed("user1");
    expect(limiter.isAllowed("user1")).toBe(false);
  });

  it("should track limits per user", () => {
    limiter.isAllowed("user1");
    limiter.isAllowed("user1");
    expect(limiter.isAllowed("user2")).toBe(true);
  });

  it("should return remaining count", () => {
    limiter.isAllowed("user1");
    const remaining = limiter.getRemaining("user1");
    expect(remaining).toBe(1);
  });

  it("should reset user limit", () => {
    limiter.isAllowed("user1");
    limiter.isAllowed("user1");
    limiter.reset("user1");
    expect(limiter.isAllowed("user1")).toBe(true);
  });
});

describe("Cache", () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = createCache<string>({ maxSize: 3, defaultTTL: 100 });
  });

  it("should set and get values", () => {
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("should return undefined for missing keys", () => {
    expect(cache.get("missing")).toBeUndefined();
  });

  it("should check existence", () => {
    cache.set("key1", "value1");
    expect(cache.has("key1")).toBe(true);
    expect(cache.has("missing")).toBe(false);
  });

  it("should delete values", () => {
    cache.set("key1", "value1");
    cache.delete("key1");
    expect(cache.get("key1")).toBeUndefined();
  });

  it("should enforce max size", () => {
    cache.set("key1", "value1");
    cache.set("key2", "value2");
    cache.set("key3", "value3");
    cache.set("key4", "value4");

    expect(cache.size()).toBeLessThanOrEqual(3);
  });

  it("should expire values", async () => {
    cache.set("key1", "value1", 10);
    await new Promise((r) => setTimeout(r, 15));
    expect(cache.get("key1")).toBeUndefined();
  });
});

describe("Errors", () => {
  it("should create DebateError", () => {
    const error = new DebateError("Test", "TEST_ERROR", 400);
    expect(error.message).toBe("Test");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.statusCode).toBe(400);
  });

  it("should create ProviderError", () => {
    const error = new ProviderError("Failed");
    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.statusCode).toBe(502);
  });

  it("should create TimeoutError", () => {
    const error = new TimeoutError();
    expect(error.code).toBe("TIMEOUT");
    expect(error.statusCode).toBe(504);
  });

  it("should create ValidationError", () => {
    const error = new ValidationError("Invalid");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
  });

  it("should check isDebateError", () => {
    const debateError = new DebateError("Test", "TEST");
    const regularError = new Error("Test");

    expect(isDebateError(debateError)).toBe(true);
    expect(isDebateError(regularError)).toBe(false);
  });

  it("should format DebateError", () => {
    const error = new DebateError("Test", "TEST", 400, { details: true });
    const formatted = formatError(error);

    expect(formatted.message).toBe("Test");
    expect(formatted.code).toBe("TEST");
    expect(formatted.details).toEqual({ details: true });
  });

  it("should format regular error", () => {
    const error = new Error("Test");
    const formatted = formatError(error);

    expect(formatted.message).toBe("Test");
    expect(formatted.code).toBe("INTERNAL_ERROR");
  });
});

describe("CLI Commands", () => {
  it("should parse debate command", async () => {
    const { runCommand } = await import("../../src/cli");
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await runCommand("agents");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("QueryCache", () => {
  it("should cache queries", async () => {
    const { queryCache } = await import("../../src/utils/cache");
    
    queryCache.set("What is AI?", "AI is artificial intelligence.");
    
    const cached = queryCache.get("What is AI?");
    expect(cached).toBe("AI is artificial intelligence.");
  });
});