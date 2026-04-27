import { Tool, ToolAdapter } from "./tool.interface";
import { updateDebateCanvas } from "../../persistence/database";

export const CANVAS_TOOL_NAME = "update_shared_canvas";

export function createCanvasTool(): Tool {
  return {
    name: CANVAS_TOOL_NAME,
    description: "Updates the content of the shared workspace (canvas) visible to both agents and the user. Use this to finalize code, documents, or diagrams.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The full new content of the canvas."
        }
      },
      required: ["content"]
    },
    outputSchema: {
      type: "object"
    },
    isAsync: true
  };
}

export const CanvasToolAdapter: ToolAdapter = async (args: Record<string, unknown>, context?: any) => {
  const content = args.content as string;
  const sessionId = context?.sessionId;
  
  if (!sessionId) {
    throw new Error("CANVAS_ERROR: No sessionId provided in tool context");
  }

  try {
    await updateDebateCanvas(sessionId, content);
    return { success: true, message: "Canvas updated successfully." };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};
