export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolSchema;
  readonly outputSchema: ToolSchema;
  readonly isAsync?: boolean;
}

export interface ToolSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface ToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
  callId?: string;
}

export interface ToolResult {
  callId: string;
  toolName: string;
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface ToolContext {
  sessionId?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export type ToolAdapter = (args: Record<string, unknown>, context?: ToolContext) => Promise<unknown>;

export interface IToolRegistry {
  register(tool: Tool): void;
  unregister(name: string): void;
  get(name: string): Tool | undefined;
  getAll(): Tool[];
  has(name: string): boolean;
}

export interface IToolExecutor {
  execute(call: ToolCall, context?: ToolContext): Promise<ToolResult>;
  executeMultiple(calls: ToolCall[], context?: ToolContext): Promise<ToolResult[]>;
}