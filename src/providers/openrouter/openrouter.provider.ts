import type { Provider, ProviderMessage, ProviderOptions, ProviderResponse, ProviderModel } from "../base/provider.interface";
import { logger } from "../../observability/logging";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

export class OpenRouterProvider implements Provider {
  readonly name = "openrouter";
  readonly availableModels = [
    "openrouter/auto",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-flash-1.5",
    "google/gemini-pro-1.5",
    "deepseek/deepseek-chat",
    "openai/gpt-4o",
  ];

  private apiKey?: string;
  private initialized = false;

  async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    this.initialized = true;
  }

  async chat(messages: ProviderMessage[], options?: ProviderOptions): Promise<ProviderResponse> {
    if (!this.initialized || !this.apiKey) {
      throw new Error("PROVIDER_NOT_INITIALIZED: Call initialize() with API key first");
    }

    const model = options?.model ?? "google/gemini-flash-1.5";

    const requestBody: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    };

    try {
      const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://synthesis-debate.dev",
          "X-Title": "Synthesis Debate System",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        id: string;
        choices: {
          message: { content: string };
          finish_reason: string;
        }[];
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? "No response generated";
      const usage = data.usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      return {
        id: data.id,
        model,
        content,
        usage: {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        finishReason: (choice?.finish_reason as "stop" | "length") || "stop",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[OpenRouterProvider] Request failed: ${message}`);
      throw new Error(`Failed to call OpenRouter API: ${message}`);
    }
  }

  private isRateLimitError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes("429") ||
      normalized.includes("rate-limited") ||
      normalized.includes("rate limited") ||
      normalized.includes("temporarily rate-limited") ||
      normalized.includes("quota");
  }

  getModel(modelId: string): ProviderModel | undefined {
    const models: Record<string, ProviderModel> = {
      "openrouter/auto": {
        id: "openrouter/auto",
        name: "Auto Selection",
        contextLength: 128000,
        supportsStreaming: true,
        supportsTools: false,
        pricing: { inputPer1k: 0.001, outputPer1k: 0.001 },
      },
      "anthropic/claude-3.5-sonnet": {
        id: "anthropic/claude-3.5-sonnet",
        name: "Claude 3.5 Sonnet",
        contextLength: 200000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.003, outputPer1k: 0.015 },
      },
      "google/gemini-flash-1.5": {
        id: "google/gemini-flash-1.5",
        name: "Gemini 1.5 Flash",
        contextLength: 1000000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.0001, outputPer1k: 0.0004 },
      },
      "google/gemini-pro-1.5": {
        id: "google/gemini-pro-1.5",
        name: "Gemini 1.5 Pro",
        contextLength: 1000000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.001, outputPer1k: 0.003 },
      },
      "deepseek/deepseek-chat": {
        id: "deepseek/deepseek-chat",
        name: "DeepSeek V3",
        contextLength: 64000,
        supportsStreaming: true,
        supportsTools: false,
        pricing: { inputPer1k: 0.0001, outputPer1k: 0.0002 },
      },
      "openai/gpt-4o": {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        contextLength: 128000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.0025, outputPer1k: 0.01 },
      },
    };
    return models[modelId];
  }

  isAvailable(): boolean {
    return this.initialized && !!this.apiKey;
  }
}
