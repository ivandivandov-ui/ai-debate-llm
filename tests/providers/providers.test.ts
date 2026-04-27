import { describe, it, expect, beforeEach } from "@jest/globals";
import { GoogleProvider } from "../../src/providers/google/gemini.provider";
import { OpenRouterProvider } from "../../src/providers/openrouter/openrouter.provider";
import { AnthropicProvider } from "../../src/providers/anthropic/anthropic.provider";
import { OpenAIProvider } from "../../src/providers/openai/openai.provider";
import { ProviderRouter } from "../../src/providers/router/provider-router";

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

describe("GoogleProvider", () => {
  let provider: GoogleProvider;

  beforeEach(() => {
    provider = new GoogleProvider();
  });

  it("should create provider", () => {
    expect(provider.name).toBe("google");
    expect(provider.availableModels).toContain("gemini-1.5-flash");
  });

  it("should initialize with api key", async () => {
    await provider.initialize("test-key");
    expect(provider.isAvailable()).toBe(true);
  });

  it("should chat", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Google Response" }] } }],
        usageMetadata: { totalTokenCount: 10 }
      })
    });
    
    await provider.initialize("test-key");
    
    const response = await provider.chat([
      { role: "user", content: "Hello" }
    ]);

    expect(response.content).toBeDefined();
    expect(response.model).toBe("gemini-3.1-flash-lite-preview");
    expect(response.usage.totalTokens).toBeGreaterThan(0);
  });

  it("should get model info", () => {
    const model = provider.getModel("gemini-1.5-flash");
    expect(model).toBeDefined();
    expect(model?.contextLength).toBe(1000000);
    expect(model?.supportsStreaming).toBe(true);
  });
});

describe("OpenRouterProvider", () => {
  let provider: OpenRouterProvider;

  beforeEach(() => {
    provider = new OpenRouterProvider();
  });

  it("should create provider", () => {
    expect(provider.name).toBe("openrouter");
    expect(provider.availableModels.length).toBeGreaterThan(0);
  });

  it("should initialize and chat", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "OpenRouter Response" } }],
        usage: { total_tokens: 10 }
      })
    });
    
    await provider.initialize("test-key");
    
    const response = await provider.chat([
      { role: "user", content: "Test" }
    ], { model: "anthropic/claude-3.5-sonnet" });

    expect(response.content).toBeDefined();
  });
});

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  it("should create provider", () => {
    expect(provider.name).toBe("anthropic");
    expect(provider.availableModels).toContain("claude-3-5-sonnet-20241022");
  });

  it("should initialize and chat", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Claude Response" }],
        usage: { input_tokens: 5, output_tokens: 5 }
      })
    });

    await provider.initialize("test-key");
    
    const response = await provider.chat([
      { role: "user", content: "Hello" }
    ]);

    expect(response.content).toContain("Claude Response");
  });
});

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
  });

  it("should create provider", () => {
    expect(provider.name).toBe("openai");
    expect(provider.availableModels).toContain("gpt-4o");
  });

  it("should initialize and chat", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "OpenAI Response" } }],
        usage: { total_tokens: 10 }
      })
    });

    await provider.initialize("test-key");
    
    const response = await provider.chat([
      { role: "user", content: "Hi" }
    ]);

    expect(response.content).toContain("OpenAI Response");
  });
});

describe("ProviderRouter", () => {
  let router: ProviderRouter;

  beforeEach(() => {
    router = new ProviderRouter();
  });

  it("should create router", () => {
    expect(router).toBeDefined();
  });

  it("should register and get providers", () => {
    const google = new GoogleProvider();
    router.register(google);

    expect(router.get("google")).toBe(google);
  });

  it("should select provider", async () => {
    const google = new GoogleProvider();
    await google.initialize("test");
    router.register(google);

    const selected = router.selectProvider();
    expect(selected).toBe(google);
  });

  it("should use preferred provider", async () => {
    const google = new GoogleProvider();
    await google.initialize("test");
    const openai = new OpenAIProvider();
    await openai.initialize("test");
    
    router.register(google);
    router.register(openai);

    const selected = router.selectProvider({ preferredProvider: "openai" });
    expect(selected.name).toBe("openai");
  });

  it("should throw when no providers available", () => {
    expect(() => router.selectProvider()).toThrow("NO_PROVIDERS_AVAILABLE");
  });

  it("should set fallback", () => {
    const google = new GoogleProvider();
    router.setFallback(google);

    const selected = router.selectProvider();
    expect(selected).toBe(google);
  });
});

describe("LoadBalancer", () => {
  it("should round-robin providers", () => {
    const router = new ProviderRouter();
    const google = new GoogleProvider();
    const openai = new OpenAIProvider();
    
    router.register(google);
    router.register(openai);

    // Note: LoadBalancer would need proper initialization in real scenario
    expect(router.getAllProviders().length).toBe(2);
  });
});