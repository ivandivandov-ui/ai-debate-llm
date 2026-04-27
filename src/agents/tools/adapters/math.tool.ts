import type { Tool, ToolAdapter } from "../tool.interface";

export async function calculate(expression: string): Promise<number> {
  try {
    const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, "");
    if (!sanitized) throw new Error("Invalid expression");
    
    const result = Function(`"use strict"; return (${sanitized})`)();
    return typeof result === "number" ? result : NaN;
  } catch {
    throw new Error("Invalid expression");
  }
}

export const MathToolAdapter: ToolAdapter = async (args: Record<string, unknown>) => {
  const expression = args.expression as string;
  return calculate(expression);
};

export function createMathTool(): Tool {
  return {
    name: "math",
    description: "Evaluate mathematical expressions",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string" },
      },
      required: ["expression"],
    },
    outputSchema: {
      type: "number",
    },
  };
}

export function createCalculatorTool(): Tool {
  return {
    name: "calculator",
    description: "Perform calculations",
    inputSchema: {
      type: "object",
      properties: {
        operation: { 
          type: "string",
          enum: ["add", "subtract", "multiply", "divide", "power", "sqrt", "abs", "round"]
        },
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["operation", "a"],
    },
    outputSchema: {
      type: "number",
    },
  };
}