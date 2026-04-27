import { describe, it, expect, beforeEach } from "@jest/globals";
import { Validator, minLength, maxLength, required } from "../../src/utils/validation";
import { RateLimiter } from "../../src/utils/rate-limiter";
import { Cache } from "../../src/utils/cache";
import { DebateError } from "../../src/utils/errors";

describe("Additional Validation", () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  it("should validate required fields", () => {
    const result = validator.validate({}, { rules: [required("name")] });
    expect(result).toBe(false);
    expect(validator.getErrors()).toHaveProperty("name");
  });

  it("should validate min length", () => {
    const result = validator.validate({ name: "a" }, { rules: [minLength("name", 3)] });
    expect(result).toBe(false);
  });

  it("should validate max length", () => {
    const result = validator.validate({ name: "abc" }, { rules: [maxLength("name", 2)] });
    expect(result).toBe(false);
  });

  it("should pass all validations", () => {
    const result = validator.validate(
      { name: "test", query: "hello world" },
      { rules: [required("name"), minLength("name", 1), maxLength("name", 10)] }
    );
    expect(result).toBe(true);
  });
});

describe("EventEmitter", () => {
  it("should emit events", async () => {
    const { EventEmitter } = await import("../../src/utils/helpers");
    const emitter = new EventEmitter<number>();
    const spy = jest.fn();

    emitter.on("test", spy);
    emitter.emit("test", 42);

    expect(spy).toHaveBeenCalledWith(42);
  });

  it("should remove listeners", async () => {
    const { EventEmitter } = await import("../../src/utils/helpers");
    const emitter = new EventEmitter<number>();
    const spy = jest.fn();

    emitter.on("test", spy);
    emitter.off("test", spy);
    emitter.emit("test", 42);

    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Retry", () => {
  it("should retry failed operations", async () => {
    const { retry } = await import("../../src/utils/helpers");
    let attempts = 0;

    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("fail");
        return "success";
      },
      { maxRetries: 3, initialDelayMs: 10 }
    );

    expect(result).toBe("success");
  });

  it("should throw after max retries", async () => {
    const { retry } = await import("../../src/utils/helpers");

    await expect(
      retry(
        async () => {
          throw new Error("fail");
        },
        { maxRetries: 2, initialDelayMs: 10 }
      )
    ).rejects.toThrow("fail");
  });
});

describe("Chunk", () => {
  it("should split array into chunks", async () => {
    const { chunk } = await import("../../src/utils/helpers");
    const result = chunk([1, 2, 3, 4, 5], 2);

    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("Unique", () => {
  it("should filter unique values", async () => {
    const { unique } = await import("../../src/utils/helpers");
    const result = unique([1, 2, 1, 3, 2]);

    expect(result).toEqual([1, 2, 3]);
  });

  it("should filter by key", async () => {
    const { unique } = await import("../../src/utils/helpers");
    const result = unique([{ a: 1 }, { a: 1 }, { a: 2 }], (x: any) => x.a);

    expect(result.length).toBe(2);
  });
});

describe("GroupBy", () => {
  it("should group by key", async () => {
    const { groupBy } = await import("../../src/utils/helpers");
    const result = groupBy([{ type: "a" }, { type: "b" }, { type: "a" }], (x: any) => x.type);

    expect(result.a).toHaveLength(2);
    expect(result.b).toHaveLength(1);
  });
});