import type { Tool, ToolCall, ToolResult, ToolContext } from "../tool.interface";
import type { ToolAdapter } from "../executor";
import { logger } from "../../../observability/logging";

export async function searchTool(query: string, apiKey?: string): Promise<any> {
  if (!apiKey || apiKey === "mock") {
    logger.info(`[SearchTool] Using mock results for query: ${query}`);
    return [`Result 1 for: ${query}`, `Result 2 for: ${query}`, `Result 3 for: ${query}`];
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "smart",
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json() as { results: any[] };
    return data.results;
  } catch (error) {
    logger.error(`[SearchTool] Real search failed:`, { error: String(error) });
    return [`Error performing real search: ${error instanceof Error ? error.message : String(error)}`];
  }
}

export const SearchToolAdapter: ToolAdapter = async (args: Record<string, unknown>, context?: ToolContext) => {
  const query = args.query as string;
  const apiKey = (context?.metadata?.tavilyApiKey as string) || process.env.TAVILY_API_KEY;
  return searchTool(query, apiKey);
};

export function createSearchTool(): Tool {
  return {
    name: "search",
    description: "Search the web for up-to-date information",
    inputSchema: {
      type: "object",
      properties: { 
        query: { type: "string", description: "The search query" } 
      },
      required: ["query"],
    },
    outputSchema: {
      type: "array",
    },
    isAsync: true
  };
}