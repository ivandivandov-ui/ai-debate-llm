import type { Tool, ToolAdapter, ToolContext } from "../tool.interface";
import { MCPClient } from "../mcp-client";

export class MCPToolAdapter {
  private client: MCPClient;

  constructor(baseUrl: string) {
    this.client = new MCPClient({ baseUrl });
  }

  async createTools(): Promise<Tool[]> {
    const mcpTools = await this.client.listTools();
    return mcpTools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      outputSchema: { type: "object" },
      isAsync: true
    }));
  }

  getAdapter(toolName: string): ToolAdapter {
    return async (args: Record<string, unknown>, _context?: ToolContext) => {
      return this.client.callTool(toolName, args);
    };
  }
}
