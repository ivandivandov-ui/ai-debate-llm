import { logger } from "../../observability/logging";

export interface MCPConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: any;
}

export class MCPClient {
  private config: MCPConfig;

  constructor(config: MCPConfig) {
    this.config = {
      timeout: 10000,
      ...config,
    };
  }

  async listTools(): Promise<MCPToolInfo[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/tools`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`MCP error: ${response.statusText}`);
      }

      const data = await response.json() as { tools?: MCPToolInfo[] };
      return data.tools || [];
    } catch (error) {
      logger.error("[MCPClient] Failed to list tools:", { error: String(error) });
      return [];
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/tools/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify({
          name,
          arguments: args,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP error: ${response.statusText}`);
      }

      const data = await response.json() as { result: any };
      return data.result;
    } catch (error) {
      logger.error(`[MCPClient] Failed to call tool ${name}:`, { error: String(error) });
      throw error;
    }
  }
}
