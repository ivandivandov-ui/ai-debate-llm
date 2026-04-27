import type { Provider, ProviderMessage, ProviderOptions, ProviderResponse, ProviderModel } from "../base/provider.interface";

const GROQ_API_BASE = "https://api.groq.com/openai/v1";

export class GroqProvider implements Provider {
  readonly name = "groq";
  readonly availableModels = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];

  private apiKey?: string;
  private initialized = false;

  async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    this.initialized = true;
  }

  isAvailable(): boolean {
    return this.initialized && !!this.apiKey;
  }

  getModel(modelId: string): ProviderModel | undefined {
    const modelMap: Record<string, ProviderModel> = {
      "llama-3.3-70b-versatile": {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B",
        contextLength: 128000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.00059, outputPer1k: 0.00079 }
      },
      "llama-3.1-70b-versatile": {
        id: "llama-3.1-70b-versatile",
        name: "Llama 3.1 70B",
        contextLength: 128000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.00059, outputPer1k: 0.00079 }
      },
      "llama-3.1-8b-instant": {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B",
        contextLength: 128000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.00005, outputPer1k: 0.00008 }
      },
      "mixtral-8x7b-32768": {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B",
        contextLength: 32768,
        supportsStreaming: true,
        supportsTools: false,
        pricing: { inputPer1k: 0.00024, outputPer1k: 0.00024 }
      }
    };
    return modelMap[modelId];
  }

  async chat(messages: ProviderMessage[], options?: ProviderOptions): Promise<ProviderResponse> {
    if (!this.initialized || !this.apiKey) {
      throw new Error("PROVIDER_NOT_INITIALIZED: Call initialize() with API key first");
    }

    const model = options?.model ?? "llama-3.3-70b-versatile";

    const requestBody: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
      top_p: options?.topP ?? 1,
    };

    if (options?.stop) {
      requestBody.stop = options.stop;
    }

    try {
      const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GROQ_API_ERROR: ${response.status} ${error}`);
      }

      const data: any = await response.json();

      return {
        id: data.id || `groq-${Date.now()}`,
        content: data.choices[0].message.content,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        model: data.model,
        finishReason: data.choices[0].finish_reason,
      };
    } catch (error) {
      throw new Error(`GROQ_PROVIDER_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listModels(): Promise<ProviderModel[]> {
    return this.availableModels.map(model => this.getModel(model)!).filter(Boolean);
  }
}