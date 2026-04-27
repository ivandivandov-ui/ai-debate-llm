import type { Tool, ToolCall, ToolResult, ToolContext, IToolExecutor, IToolRegistry } from "./tool.interface";
import type { ToolRegistry } from "./tool-registry";

export class ToolExecutor implements IToolExecutor {
  private registry: ToolRegistry;
  private adapters: Map<string, ToolAdapter>;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
    this.adapters = new Map();
  }

  registerAdapter(name: string, adapter: ToolAdapter): void {
    this.adapters.set(name, adapter);
  }

  async execute(call: ToolCall, context?: ToolContext): Promise<ToolResult> {
    const tool = this.registry.get(call.toolName);
    if (!tool) {
      return {
        callId: call.callId ?? crypto.randomUUID(),
        toolName: call.toolName,
        success: false,
        error: `TOOL_NOT_FOUND: ${call.toolName}`,
      };
    }

    const adapter = this.adapters.get(call.toolName);
    if (adapter) {
      try {
        const output = await adapter(call.arguments, context);
        return {
          callId: call.callId ?? crypto.randomUUID(),
          toolName: call.toolName,
          success: true,
          output,
        };
      } catch (error) {
        return {
          callId: call.callId ?? crypto.randomUUID(),
          toolName: call.toolName,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      callId: call.callId ?? crypto.randomUUID(),
      toolName: call.toolName,
      success: true,
      output: call.arguments,
    };
  }

  async executeMultiple(calls: ToolCall[], context?: ToolContext): Promise<ToolResult[]> {
    return Promise.all(calls.map((call) => this.execute(call, context)));
  }
}

export type ToolAdapter = (
  args: Record<string, unknown>,
  context?: ToolContext
) => Promise<unknown>;

export function createToolExecutor(registry: ToolRegistry): ToolExecutor {
  return new ToolExecutor(registry);
}