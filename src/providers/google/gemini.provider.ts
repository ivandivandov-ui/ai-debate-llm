import type { Provider, ProviderMessage, ProviderOptions, ProviderResponse, ProviderModel } from "../base/provider.interface";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GoogleProvider implements Provider {
  readonly name = "google";
  readonly availableModels = [
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
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

    const model = options?.model ?? "gemini-3.1-flash-lite-preview";
    const modelName = model;

    const system = messages.find(m => m.role === "system")?.content;
    const userMessages = messages.filter(m => m.role !== "system");
    
    const contents: { role: string; parts: any[] }[] = [];
    
    for (const msg of userMessages) {
      const parts: any[] = [];
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text") parts.push({ text: block.text });
          else if (block.type === "image_url") {
            // Note: Gemini API expects inlineData or fileData, not a direct URL usually 
            // but for simplicity we'll just put text if it's not handled
            parts.push({ text: `[Image: ${block.image_url?.url}]` });
          }
        }
      } else {
        parts.push({ text: msg.content });
      }
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts
      });
    }

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
        topP: options?.topP ?? 0.95,
        stopSequences: options?.stop,
      },
    };

    if (system) {
      requestBody.system_instruction = {
        parts: Array.isArray(system) 
          ? system.map(s => s.type === "text" ? { text: s.text } : { text: JSON.stringify(s) })
          : [{ text: system }]
      };
    }

    try {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${modelName}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        candidates?: {
          content?: {
            parts?: { text: string }[];
          };
        }[];
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response generated";
      const usage = data.usageMetadata ?? {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      };

      return {
        id: `chatcmpl-${Date.now()}`,
        model,
        content,
        usage: {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? ((usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0)),
        },
        finishReason: "stop",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!this.isRateLimitError(message)) {
        console.error("[GoogleProvider Error]", error);
      }
      if (error instanceof Error && error.message.includes("Google API error")) {
        throw error;
      }
      throw new Error(`Failed to call Google API: ${message}`);
    }
  }

  private isRateLimitError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes("429") ||
      normalized.includes("quota exceeded") ||
      normalized.includes("resource_exhausted") ||
      normalized.includes("rate-limit") ||
      normalized.includes("rate limited");
  }

  getModel(modelId: string): ProviderModel | undefined {
    const models: Record<string, ProviderModel> = {
      "gemini-1.5-flash": {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        contextLength: 1000000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.000075, outputPer1k: 0.0003 },
      },
      "gemini-1.5-pro": {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        contextLength: 1000000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.00125, outputPer1k: 0.005 },
      },
      "gemini-pro": {
        id: "gemini-pro",
        name: "Gemini 1.0 Pro",
        contextLength: 32768,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.0001, outputPer1k: 0.0004 },
      },
    };
    return models[modelId];
  }

  isAvailable(): boolean {
    return this.initialized && !!this.apiKey;
  }
}
