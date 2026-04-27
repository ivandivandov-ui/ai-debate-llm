import type { Tool, ToolSchema, IToolRegistry } from "./tool.interface";

export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {}

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`TOOL_EXISTS: ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}

export function createTool(
  name: string,
  description: string,
  inputSchema: ToolSchema,
  outputSchema: ToolSchema
): Tool {
  return { name, description, inputSchema, outputSchema };
}

export function createStringTool(
  name: string,
  description: string
): Tool {
  return {
    name,
    description,
    inputSchema: { type: "string" },
    outputSchema: { type: "string" },
  };
}

export function createObjectTool(
  name: string,
  description: string,
  inputSchema: ToolSchema,
  outputSchema: ToolSchema
): Tool {
  return {
    name,
    description,
    inputSchema,
    outputSchema,
  };
}