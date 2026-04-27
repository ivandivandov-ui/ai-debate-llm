import { StdioMCPClient, StdioMCPConfig } from "../agents/tools/mcp/stdio-client";
import { MCPClient } from "../agents/tools/mcp-client";
import { MCPToolAdapter } from "../agents/tools/adapters/mcp.tool";
import { GlobalRegistry } from "./global-registry";
import { logger } from "../observability/logging";

export interface MCPServerConfig {
  id: string;
  name: string;
  type: "http" | "stdio";
  baseUrl?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

export class MCPManager {
  private static instance: MCPManager;
  private servers: Map<string, MCPServerConfig> = new Map();
  private stdioClients: Map<string, StdioMCPClient> = new Map();

  private constructor() {}

  static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  async registerServer(config: MCPServerConfig): Promise<void> {
    logger.info(`[MCPManager] Registering ${config.type} server: ${config.name}`);
    this.servers.set(config.id, config);

    const registry = GlobalRegistry.getInstance();

    if (config.type === "http" && config.baseUrl) {
      await registry.registerMCPServer(config.baseUrl);
    } else if (config.type === "stdio" && config.command) {
      const client = new StdioMCPClient({
        command: config.command,
        args: config.args,
        env: config.env,
      });
      this.stdioClients.set(config.id, client);
      
      try {
        await client.start();
        const tools = await client.listTools();
        const toolRegistry = registry.getToolRegistry();
        const toolExecutor = registry.getToolExecutor();

        for (const t of tools) {
          const toolId = `${config.id}_${t.name}`;
          toolRegistry.register({
            name: toolId,
            description: `[MCP: ${config.name}] ${t.description}`,
            inputSchema: t.inputSchema,
            outputSchema: { type: "object" },
            isAsync: true
          });
          toolExecutor.registerAdapter(toolId, async (args) => {
            return client.callTool(t.name, args);
          });
        }
        logger.info(`[MCPManager] Registered ${tools.length} tools from ${config.name}`);
      } catch (err) {
        logger.error(`[MCPManager] Failed to start stdio server ${config.name}:`, { error: String(err) });
      }
    }
  }

  getAllServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  async shutdown(): Promise<void> {
    for (const client of this.stdioClients.values()) {
      client.stop();
    }
    this.stdioClients.clear();
  }
}
