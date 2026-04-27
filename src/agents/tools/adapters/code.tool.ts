import type { Tool, ToolContext } from "../tool.interface";
import type { ToolAdapter } from "../executor";
import * as vm from "vm";
import { logger } from "../../../observability/logging";

export async function executeCode(code: string): Promise<any> {
  const sandbox = {
    console: {
      log: (...args: any[]) => logs.push(args.map(String).join(" ")),
    },
  };
  const logs: string[] = [];
  
  try {
    const script = new vm.Script(code);
    const context = vm.createContext(sandbox);
    const result = script.runInContext(context, { timeout: 5000 });
    
    return {
      result,
      stdout: logs.join("\n"),
    };
  } catch (error) {
    logger.error(`[CodeTool] Execution failed:`, { error: String(error) });
    return {
      error: error instanceof Error ? error.message : String(error),
      stdout: logs.join("\n"),
    };
  }
}

export const CodeToolAdapter: ToolAdapter = async (args: Record<string, unknown>, _context?: ToolContext) => {
  const code = args.code as string;
  return executeCode(code);
};

export function createCodeTool(): Tool {
  return {
    name: "code_interpreter",
    description: "Execute JavaScript code in a sandboxed environment",
    inputSchema: {
      type: "object",
      properties: { 
        code: { type: "string", description: "The JavaScript code to execute" } 
      },
      required: ["code"],
    },
    outputSchema: {
      type: "object",
    },
    isAsync: true
  };
}