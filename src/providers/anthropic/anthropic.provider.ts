import type { Provider, ProviderMessage, ProviderOptions, ProviderResponse, ProviderModel } from "../base/provider.interface";

const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";

export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  readonly availableModels = ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"];

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

    const model = options?.model ?? "claude-3-5-sonnet-20241022";
    
    const systemMessage = messages.find(m => m.role === "system")?.content;
    const userMessages = messages.filter(m => m.role !== "system");

    const requestBody: Record<string, unknown> = {
      model,
      messages: userMessages.map(m => {
        // Anthropic requires content to be array for tool use or multimodal
        if (Array.isArray(m.content)) {
          return { role: m.role, content: m.content };
        }
        return { role: m.role, content: m.content };
      }),
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
    };

    if (options?.tools && options.tools.length > 0) {
      requestBody.tools = options.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    if (systemMessage) {
      requestBody.system = systemMessage;
    }

    try {
      const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        id: string;
        content: { 
          type: "text" | "tool_use"; 
          text?: string; 
          id?: string;
          name?: string;
          input?: any;
        }[];
        stop_reason: string;
        usage: {
          input_tokens: number;
          output_tokens: number;
        };
      };

      const content = data.content
        .filter(c => c.type === "text")
        .map(c => c.text)
        .join("\n") || "";
      
      const toolCalls = data.content
        .filter(c => c.type === "tool_use")
        .map(tc => ({
          id: tc.id!,
          type: "function" as const,
          function: {
            name: tc.name!,
            arguments: JSON.stringify(tc.input),
          },
        }));
      
      const usage = data.usage ?? { input_tokens: 0, output_tokens: 0 };

      return {
        id: data.id,
        model,
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          totalTokens: usage.input_tokens + usage.output_tokens,
        },
        finishReason: (data.stop_reason as any) || "stop",
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Anthropic API error")) {
        throw error;
      }
      throw new Error(`Failed to call Anthropic API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getModel(modelId: string): ProviderModel | undefined {
    const models: Record<string, ProviderModel> = {
      "claude-3-5-sonnet-20241022": {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        contextLength: 200000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.003, outputPer1k: 0.015 },
      },
      "claude-3-opus-20240229": {
        id: "claude-3-opus-20240229",
        name: "Claude 3 Opus",
        contextLength: 200000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.015, outputPer1k: 0.075 },
      },
      "claude-3-haiku-20240307": {
        id: "claude-3-haiku-20240307",
        name: "Claude 3 Haiku",
        contextLength: 200000,
        supportsStreaming: true,
        supportsTools: true,
        pricing: { inputPer1k: 0.00025, outputPer1k: 0.00125 },
      },
    };
    return models[modelId];
  }

  isAvailable(): boolean {
    return this.initialized && !!this.apiKey;
  }
}