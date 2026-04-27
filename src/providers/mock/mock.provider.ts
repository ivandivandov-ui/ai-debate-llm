import type { Provider, ProviderMessage, ProviderOptions, ProviderResponse, ProviderModel } from "../base/provider.interface";

export class MockProvider implements Provider {
  readonly name = "mock";
  readonly availableModels = ["mock-model"];

  private apiKey?: string;
  private initialized = false;

  async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    this.initialized = true;
  }

  async chat(messages: ProviderMessage[], options?: ProviderOptions): Promise<ProviderResponse> {
    const model = options?.model ?? "mock-model";
    
    const stringifyContent = (c: any) => Array.isArray(c) ? c.map(b => b.text || "").join(" ") : String(c);
    
    // Simple logic to generate somewhat relevant mock responses
    const systemPrompt = stringifyContent(messages.find(m => m.role === "system")?.content || "").toLowerCase();
    const lastMessage = stringifyContent(messages[messages.length - 1].content).toLowerCase();
    
    let content = "This is a mock response from the Synthesis Debate System.";
    
    if (systemPrompt.includes("critic")) {
      content = "As a Critic, I've analyzed the proposal and found several vulnerabilities in the current architecture, specifically regarding data integrity.";
    } else if (systemPrompt.includes("skeptic")) {
      content = "As a Skeptic, I question the underlying assumptions about user behavior and suggest we need more empirical data before proceeding.";
    } else if (systemPrompt.includes("scientist")) {
      content = "Based on my research as a Scientist, the proposed methodology aligns with established industry standards, though optimization is possible.";
    } else if (systemPrompt.includes("verifier")) {
      content = "Verification complete: I have cross-referenced all claims against the available documentation and confirm they are 95% accurate.";
    } else if (systemPrompt.includes("builder")) {
      content = "As a Builder, I have constructed a robust implementation plan that addresses the core requirements while maintaining system flexibility.";
    } else if (lastMessage.includes("pro") || lastMessage.includes("support")) {
      content = "I strongly support this proposal based on efficiency and scalability benefits.";
    } else if (lastMessage.includes("con") || lastMessage.includes("against")) {
      content = "I oppose this due to potential security risks and maintenance overhead.";
    }

    return {
      id: `mock-${Date.now()}`,
      model,
      content,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      },
      finishReason: "stop",
    };
  }

  getModel(_modelId: string): ProviderModel | undefined {
    return {
      id: "mock-model",
      name: "Mock Model",
      contextLength: 4096,
      supportsStreaming: false,
      supportsTools: false,
      pricing: { inputPer1k: 0, outputPer1k: 0 },
    };
  }

  isAvailable(): boolean {
    return this.initialized && !!this.apiKey;
  }
}
