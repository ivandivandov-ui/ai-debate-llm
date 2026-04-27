import { spawn, ChildProcess } from "node:child_process";
import { logger } from "../../../observability/logging";
import type { MCPToolInfo } from "../mcp-client";

export interface StdioMCPConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class StdioMCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests: Map<number, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private buffer = "";

  constructor(private config: StdioMCPConfig) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, this.config.args || [], {
          env: { ...process.env, ...this.config.env },
          stdio: ["pipe", "pipe", "pipe"],
        });

        this.process.stdout?.on("data", (data) => {
          this.handleData(data.toString());
        });

        this.process.stderr?.on("data", (data) => {
          logger.warn(`[MCP Stdio: ${this.config.command}] stderr: ${data}`);
        });

        this.process.on("error", (err) => {
          logger.error(`[MCP Stdio: ${this.config.command}] Process error:`, { error: err.message });
          reject(err);
        });

        this.process.on("exit", (code) => {
          logger.info(`[MCP Stdio: ${this.config.command}] Process exited with code ${code}`);
          this.process = null;
        });

        // Basic handshake or just wait a bit
        setTimeout(resolve, 500);
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        if (response.id !== undefined) {
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            if (response.error) {
              pending.reject(response.error);
            } else {
              pending.resolve(response.result);
            }
          }
        }
      } catch (e) {
        logger.error("[MCP Stdio] Failed to parse response line:", { line, error: String(e) });
      }
    }
  }

  async call(method: string, params: any): Promise<any> {
    if (!this.process) {
      await this.start();
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(request) + "\n");
      
      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP Timeout: ${method} took too long`));
        }
      }, 30000);
    });
  }

  async listTools(): Promise<MCPToolInfo[]> {
    const result = await this.call("tools/list", {});
    return result.tools || [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    const result = await this.call("tools/call", { name, arguments: args });
    return result;
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
  }
}
