export interface Provider {
  readonly name: string;
  readonly availableModels: string[];
  initialize(apiKey: string): Promise<void>;
  chat(messages: ProviderMessage[], options?: ProviderOptions): Promise<ProviderResponse>;
  chatStream?(messages: ProviderMessage[], options?: ProviderOptions): AsyncIterable<ProviderStreamChunk>;
  getModel(modelId: string): ProviderModel | undefined;
  isAvailable(): boolean;
}

export type MessageContent = string | ContentBlock[];

export interface ContentBlock {
  type: "text" | "image_url" | "audio";
  text?: string;
  image_url?: { url: string; detail?: "low" | "high" | "auto" };
  audio?: { data: string; format: "wav" | "mp3" };
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: MessageContent;
  name?: string;
  tool_call_id?: string;
}

export interface ProviderOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: ProviderTool[];
  signal?: AbortSignal;
}

export interface ProviderResponse {
  id: string;
  model: string;
  content: string;
  toolCalls?: ProviderToolCall[];
  usage: ProviderUsage;
  finishReason: "stop" | "length" | "content_filter" | "tool_calls";
}

export interface ProviderToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ProviderStreamChunk {
  id: string;
  delta: string;
  usage?: ProviderUsage;
  finishReason?: "stop" | "length";
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ProviderModel {
  id: string;
  name: string;
  contextLength: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  pricing: ProviderPricing;
}

export interface ProviderPricing {
  inputPer1k: number;
  outputPer1k: number;
}

export interface ProviderTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface IProviderRouter {
  selectProvider(context: RoutingContext): Provider;
  getAllProviders(): Provider[];
  register(provider: Provider): void;
  unregister(name: string): void;
  reportLatency(providerName: string, latencyMs: number): void;
}

export interface RoutingContext {
  requiredCapabilities?: string[];
  preferredProvider?: string;
  budget?: number;
  latency?: "low" | "medium" | "high";
}