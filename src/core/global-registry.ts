import type { Provider } from "../providers/base/provider.interface";
import { ProviderRouter } from "../providers/router/provider-router";
import { ProtocolRegistry, SocraticProtocol, AdversarialProtocol, RedTeamProtocol, ConsensusProtocol } from "../protocols/implementation";
import { DebateOrchestrator } from "../orchestration/debate-orchestrator";
import { ToolRegistry } from "../agents/tools/tool-registry";
import { ToolExecutor } from "../agents/tools/executor";
import { MCPToolAdapter } from "../agents/tools/adapters/mcp.tool";
import { createSearchTool, SearchToolAdapter } from "../agents/tools/adapters/search.tool";
import { createCodeTool, CodeToolAdapter } from "../agents/tools/adapters/code.tool";
import { createCanvasTool, CanvasToolAdapter } from "../agents/tools/canvas-tools";

export class GlobalRegistry {
  private static instance: GlobalRegistry;
  private providers: Map<string, Provider> = new Map();
  private router?: ProviderRouter;
  private protocols: ProtocolRegistry;
  private orchestrator?: DebateOrchestrator;
  private toolRegistry: ToolRegistry = new ToolRegistry();
  private toolExecutor: ToolExecutor = new ToolExecutor(this.toolRegistry);

  private constructor() {
    this.protocols = new ProtocolRegistry();
    // Register default protocols
    this.protocols.register(new SocraticProtocol());
    this.protocols.register(new AdversarialProtocol());
    this.protocols.register(new RedTeamProtocol());
    this.protocols.register(new ConsensusProtocol());
    
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    // Search
    const search = createSearchTool();
    this.toolRegistry.register(search);
    this.toolExecutor.registerAdapter(search.name, SearchToolAdapter);

    // Code
    const code = createCodeTool();
    this.toolRegistry.register(code);
    this.toolExecutor.registerAdapter(code.name, CodeToolAdapter);

    // Canvas
    const canvasTool = createCanvasTool();
    this.toolRegistry.register(canvasTool);
    this.toolExecutor.registerAdapter(canvasTool.name, CanvasToolAdapter);
  }

  static getInstance(): GlobalRegistry {
    if (!GlobalRegistry.instance) {
      GlobalRegistry.instance = new GlobalRegistry();
    }
    return GlobalRegistry.instance;
  }

  register(provider: Provider): void {
    this.providers.set(provider.name, provider);
    this.router?.register(provider);
  }

  unregister(name: string): void {
    this.providers.delete(name);
    this.router?.unregister(name);
  }

  get(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  getProtocols(): ProtocolRegistry {
    return this.protocols;
  }

  getRouter(): ProviderRouter {
    if (!this.router) {
      this.router = new ProviderRouter();
      for (const provider of this.providers.values()) {
        this.router.register(provider);
      }
    }
    return this.router;
  }
  
  getOrchestrator(): DebateOrchestrator {
    if (!this.orchestrator) {
      this.orchestrator = new DebateOrchestrator();
    }
    return this.orchestrator;
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getToolExecutor(): ToolExecutor {
    return this.toolExecutor;
  }

  async registerMCPServer(baseUrl: string): Promise<void> {
    const adapter = new MCPToolAdapter(baseUrl);
    const tools = await adapter.createTools();
    for (const tool of tools) {
      this.toolRegistry.register(tool);
      this.toolExecutor.registerAdapter(tool.name, adapter.getAdapter(tool.name));
    }
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  clear(): void {
    for (const name of this.providers.keys()) {
      this.router?.unregister(name);
    }
    this.providers.clear();
    this.router = undefined;
  }
}
