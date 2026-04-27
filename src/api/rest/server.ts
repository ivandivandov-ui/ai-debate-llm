import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { createServer, Server } from "http";
import { v4 as uuidv4 } from "uuid";
import type { DebateRequest } from "../../core/contracts/request";
import { GlobalRegistry } from "../../core/global-registry";
import { logger } from "../../observability/logging";
import {
  saveDebate,
  updateDebateStatus,
  getAllSettings,
  getAllApiKeys,
  getDebate,
  getDebateMessages,
  getAllDebates,
  saveSetting,
  getAllRoles,
  saveRole,
  deleteRole,
} from "../../persistence/database";
import { validateDebateRequest } from "../../utils/validation";
import { RateLimiter } from "../../utils/rate-limiter";
import { AnalyticsService } from "../../core/analytics/analytics-service";
import { MCPManager } from "../../core/mcp-manager";

const app = express();
const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 });

// Middleware
app.use(cors());
app.use(express.json());

// Serve Dashboard
app.use("/dashboard", express.static(path.join(__dirname, "../../ui/dashboard")));
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../../ui/dashboard/index.html"));
});

// Rate limiting middleware
const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = req.ip || "unknown";
  if (!limiter.isAllowed(clientIp)) {
    return res.status(429).json({ error: "Too many requests" });
  }
  next();
};

app.use(rateLimitMiddleware);

// ============ Handlers ============

/**
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

/**
 * Start a new debate
 */
app.post("/api/debates", async (req: Request, res: Response) => {
  const request = req.body as DebateRequest;
  
  try {
    validateDebateRequest(request);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Validation failed" });
  }

  const debateId = uuidv4();
  request.id = debateId;
  const protocol = request.protocol || request.preferences?.protocols?.[0] || "socratic";
  const agents = ["builder", "critic", "skeptic", "scientist", "verifier"];

  try {
    await saveDebate(debateId, request.query, protocol, agents);

    const registry = GlobalRegistry.getInstance();
    const orchestrator = registry.getOrchestrator();
    
    // Ensure providers are initialized (lazy load/sync with DB)
    await ensureProvidersInitialized();
    
    orchestrator.setProviderRouter(registry.getRouter());
    
    // Fire and forget
    orchestrator.run(request).then(async (result) => {
      await updateDebateStatus(debateId, "completed", result);
    }).catch(async (error) => {
      logger.error(`[Server] Debate ${debateId} background execution failed:`, { error: error instanceof Error ? error.message : String(error) });
      await updateDebateStatus(debateId, "failed");
    });

    res.json({ id: debateId, status: "running" });
  } catch (error) {
    logger.error("[Server] createDebate error:", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      error: "Failed to initialize debate",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * List debates
 */
app.get("/api/debates", async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "50"), 100);
    const offset = parseInt((req.query.offset as string) || "0");
    const debates = await getAllDebates(limit, offset);
    res.json({ debates, limit, offset });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve debates" });
  }
});

/**
 * Get debate details
 */
app.get("/api/debates/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const debate = await getDebate(id);
    if (!debate) return res.status(404).json({ error: "Debate not found" });
    
    const messages = await getDebateMessages(id);
    res.json({ ...debate, messages, messageCount: messages.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve debate" });
  }
});

/**
 * Legacy/Compat: Get debate by ID
 */
app.get("/api/debate/:id", async (req, res) => {
  const { id } = req.params;
  const orchestrator = GlobalRegistry.getInstance().getOrchestrator();
  const state = orchestrator.getState(id as any);
  
  if (!state) {
    // Try to fallback to DB
    const debate = await getDebate(id);
    if (!debate) return res.status(404).json({ error: "Session not found" });
    return res.json({
      sessionId: debate.id,
      stage: debate.status === "completed" ? "output" : "unknown",
      round: 0,
      isComplete: debate.status === "completed",
      query: debate.query,
    });
  }
  
  res.json({
    sessionId: state.sessionId,
    stage: state.stage,
    round: state.round,
    isComplete: state.isComplete,
    query: state.request.query,
  });
});

/**
 * SSE Stream for debate updates
 */
app.get("/api/stream/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;
  
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const orchestrator = GlobalRegistry.getInstance().getOrchestrator();
  const unsubscribe = orchestrator.onStateChange((state) => {
    if (state.sessionId === id) {
      sendEvent("state", {
        stage: state.stage,
        round: state.round,
        isComplete: state.isComplete,
        messages: state.history.length,
      });
    }
  });

  sendEvent("status", { message: "Connected to debate stream", sessionId: id });

  res.on("close", () => {
    unsubscribe();
  });
});

/**
 * Human input for interactive debates
 */
app.post("/api/debates/:id/human-input", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { input } = req.body;

  try {
    const registry = GlobalRegistry.getInstance();
    const orchestrator = registry.getOrchestrator();
    
    // Resume the debate in the background
    orchestrator.resume(id as any, input).then(async (result: any) => {
      await updateDebateStatus(id, "completed", result);
    }).catch(async (error: any) => {
      logger.error(`[Server] Debate ${id} resume failed:`, { error: error instanceof Error ? error.message : String(error) });
      await updateDebateStatus(id, "failed");
    });

    res.json({ id, status: "resuming" });
  } catch (error) {
    logger.error("[Server] humanInput error:", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      error: "Failed to resume debate",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Settings
 */
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await getAllSettings();
    const dbApiKeysMetadata = await getAllApiKeys();
    
    const maskedDbApiKeys: Record<string, any> = {};
    for (const [provider, info] of Object.entries(dbApiKeysMetadata)) {
      maskedDbApiKeys[provider] = {
        ...info,
        key: info.key.substring(0, 4) + "..." + (info.key.length > 4 ? info.key.substring(info.key.length - 4) : "")
      };
    }
    
    res.json({ ...settings, dbApiKeys: maskedDbApiKeys });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve settings" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const settings = req.body as Record<string, unknown>;
    for (const [key, value] of Object.entries(settings)) {
      if (key === "apiKeys" && typeof value === "object" && value !== null) {
        const { saveApiKey } = await import("../../persistence/database");
        for (const [provider, apiKey] of Object.entries(value as Record<string, string>)) {
          if (apiKey && !apiKey.includes("...")) await saveApiKey(provider, apiKey);
        }
      }
      await saveSetting(key, value, "json");
    }
    res.json({ message: "Settings saved successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

/**
 * Roles
 */
app.get("/api/roles", async (req, res) => {
  try {
    const roles = await getAllRoles();
    res.json({ roles });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve roles" });
  }
});

app.post("/api/roles", async (req, res) => {
  try {
    await saveRole(req.body);
    res.json({ message: "Role saved successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save role" });
  }
});

app.delete("/api/roles/:id", async (req, res) => {
  try {
    await deleteRole(req.params.id);
    res.json({ message: "Role deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete role" });
  }
});

/**
 * Protocols
 */
app.get("/api/protocols", (req, res) => {
  const registry = GlobalRegistry.getInstance();
  const protocols = registry.getProtocols().getAll().map(p => ({
    name: p.name,
    description: p.description,
    maxRounds: p.maxRounds,
  }));
  res.json({ protocols });
});

/**
 * Analytics
 */
app.get("/api/analytics", async (req, res) => {
  try {
    const analytics = new AnalyticsService();
    const summary = await analytics.getSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve analytics" });
  }
});

/**
 * MCP Servers
 */
app.get("/api/mcp/servers", (req, res) => {
  const mcp = MCPManager.getInstance();
  res.json({ servers: mcp.getAllServers() });
});

app.post("/api/mcp/servers", async (req, res) => {
  try {
    const mcp = MCPManager.getInstance();
    await mcp.registerServer(req.body);
    res.json({ message: "MCP Server registered successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to register MCP server", details: String(error) });
  }
});

/**
 * Export
 */
app.get("/api/debates/:id/export/markdown", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const debate = await getDebate(id);
    if (!debate) return res.status(404).json({ error: "Debate not found" });

    const messages = await getDebateMessages(id);
    
    let md = `# Debate Report: ${debate.query}\n\n`;
    md += `**ID:** \`${debate.id}\`  \n`;
    md += `**Protocol:** ${debate.protocol}  \n`;
    md += `**Status:** ${debate.status}  \n`;
    md += `**Started:** ${new Date(debate.started_at).toLocaleString()}  \n`;
    if (debate.completed_at) {
      md += `**Completed:** ${new Date(debate.completed_at).toLocaleString()}  \n`;
    }
    
    if (debate.metrics) {
      const metrics = JSON.parse(debate.metrics);
      md += `\n## Metrics\n`;
      md += `- **Total Cost:** $${metrics.totalCost.toFixed(4)}\n`;
      md += `- **Total Rounds:** ${metrics.totalRounds}\n`;
      md += `- **Tokens Used:** ${metrics.totalTokens}\n`;
    }

    md += `\n## Transcript\n\n`;
    for (const msg of messages) {
      md += `### ${msg.agent} (${msg.type})\n`;
      md += `> ${msg.content.replace(/\n/g, "\n> ")}\n\n`;
      md += `---\n\n`;
    }

    if (debate.result_content) {
      md += `\n## Final Conclusion\n\n`;
      md += `${debate.result_content}\n`;
    }

    res.setHeader("Content-Type", "text/markdown");
    res.setHeader("Content-Disposition", `attachment; filename="debate-${id}.md"`);
    res.send(md);
  } catch (error) {
    res.status(500).json({ error: "Export failed", details: String(error) });
  }
});

/**
 * Prompt Playground
 */
app.post("/api/prompts/test", async (req: Request, res: Response) => {
  const { role, prompt, query, provider } = req.body;
  try {
    const registry = GlobalRegistry.getInstance();
    const router = registry.getRouter();
    
    // Create a temporary agent for testing
    const { BaseAgent } = await import("../../agents/base/base.agent");
    const { createAgentState } = await import("../../agents/base/agent-state");
    
    const state = createAgentState("test-agent" as any, {
      id: "test-agent" as any,
      role: role as any,
      sessionId: "test-session" as any,
      systemPrompt: prompt,
      maxTokens: 1000,
      temperature: 0.7,
      provider: provider || "google"
    });

    const testAgent = new (class extends BaseAgent {
      get role(): any { return role; }
      get capabilities(): any { return { canUseTools: false, canReason: true }; }
      async performTask(): Promise<any> { return {}; }
    })(state);
    
    testAgent.setProviderRouter(router);

    // Override system prompt
    (testAgent as any).systemPrompt = prompt;

    const result = await testAgent.execute({
      type: "argument",
      input: query,
      context: {},
    } as any);

    res.json(result);
  } catch (error) {
    logger.error("[Server] Prompt test failed:", { error: String(error) });
    res.status(500).json({ error: "Prompt test failed", details: String(error) });
  }
});

/**
 * Canvas / Workspace
 */
app.post("/api/debates/:id/canvas", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { content } = req.body;
  try {
    const { updateDebateCanvas } = await import("../../persistence/database");
    await updateDebateCanvas(id, content);
    res.json({ message: "Canvas updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update canvas", details: String(error) });
  }
});

// ============ Internal Helpers ============

async function ensureProvidersInitialized() {
  const registry = GlobalRegistry.getInstance();
  const settings = await getAllSettings();
  const dbApiKeysMetadata = await getAllApiKeys();
  
  const apiKeys: Record<string, string> = {};
  for (const [provider, info] of Object.entries(dbApiKeysMetadata)) {
    apiKeys[provider] = info.key;
  }
  
  // Base providers setup
  const providers = [
    { name: "mock", class: "MockProvider", path: "../../providers/mock/mock.provider" },
    { name: "google", class: "GoogleProvider", path: "../../providers/google/gemini.provider" },
    { name: "openrouter", class: "OpenRouterProvider", path: "../../providers/openrouter/openrouter.provider" },
    { name: "groq", class: "GroqProvider", path: "../../providers/groq/groq.provider" },
    { name: "anthropic", class: "AnthropicProvider", path: "../../providers/anthropic/anthropic.provider" },
    { name: "openai", class: "OpenAIProvider", path: "../../providers/openai/openai.provider" },
  ];

  for (const p of providers) {
    if (registry.has(p.name)) continue;
    
    try {
      const apiKey = apiKeys[p.name] || process.env[`${p.name.toUpperCase()}_API_KEY`];
      if (apiKey || p.name === "mock") {
        const mod = await import(p.path);
        const provider = new mod[p.class]();
        await provider.initialize(apiKey || "mock");
        registry.register(provider);
        if (p.name === "mock") registry.getRouter().setFallback(provider);
      }
    } catch (e) {
      logger.warn(`[Server] Failed to init provider ${p.name}:`, { error: e instanceof Error ? e.message : String(e) });
    }
  }
}

// ============ Server Start ============

export async function startServer(port = 3000): Promise<Server> {
  const server = createServer(app);
  
  return new Promise((resolve) => {
    server.listen(port, () => {
      logger.info(`Synthesis Debate API running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch(console.error);
}
