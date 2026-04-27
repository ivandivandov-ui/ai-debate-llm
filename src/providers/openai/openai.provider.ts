import type { Provider, ProviderMessage, ProviderOptions, ProviderResponse, ProviderModel } from "../base/provider.interface";

const OPENAI_API_BASE = "https://api.openai.com/v1";

export class OpenAIProvider implements Provider {
  readonly name = "openai";
  readonly availableModels = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];

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

    const model = options?.model ?? "gpt-4o";

    const requestBody: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      top_p: options?.topP ?? 1,
    };

    if (options?.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
    }

    if (options?.stop) {
      requestBody.stop = options.stop;
    }

    try {
      const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        id: string;
        choices: {
          message: { 
            content: string | null;
            tool_calls?: {
              id: string;
              type: "function";
              function: { name: string; arguments: string };
            }[];
          };
          finish_reason: string;
        }[];
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const choice = data.choices?.[0];
      const message = choice?.message;
      const content = message?.content ?? "";
      const toolCalls = message?.tool_calls;
      const usage = data.usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      return {
        id: data.id,
        model,
        content,
        toolCalls: toolCalls?.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: tc.function,
        })),
        usage: {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        finishReason: (choice?.finish_reason as any) || "stop",
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("OpenAI API error")) {
        throw error;
      }
      throw new Error(`Failed to call OpenAI API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getModel(modelId: string): ProviderModel | undefined {
    const models: Record<string, ProviderModel> = {
      "gpt-4o": {
        id: "gpt-4o",
        name: "GPT-4o",
        contextLength: 128000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.0025, outputPer1k: 0.01 },
      },
      "gpt-4o-mini": {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        contextLength: 128000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.00015, outputPer1k: 0.0006 },
      },
      "gpt-4-turbo": {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        contextLength: 128000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.01, outputPer1k: 0.03 },
      },
      "gpt-3.5-turbo": {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        contextLength: 16385,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.0005, outputPer1k: 0.0015 },
      },
    };
    return models[modelId];
  }

  isAvailable(): boolean {
    return this.initialized && !!this.apiKey;
  }
}