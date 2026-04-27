import type { Tool, ToolAdapter } from "../tool.interface";
import type { ToolContext } from "../tool.interface";

export async function queryDatabase(query: string, params?: Record<string, unknown>): Promise<unknown> {
  return { rows: [], count: 0, query, params };
}

export const DatabaseToolAdapter: ToolAdapter = async (args: Record<string, unknown>, _context?: ToolContext) => {
  const query = args.query as string;
  return queryDatabase(query, args.params as Record<string, unknown>);
};

export function createDatabaseTool(): Tool {
  return {
    name: "database",
    description: "Query a database",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        params: { type: "object" },
      },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
    },
  };
}