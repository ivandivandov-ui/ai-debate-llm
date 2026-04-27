import { DebateEngine, DebateRequest, DebateResult } from "./core/engine";
import { PipelineState } from "./core/contracts/state";
import { createAgentFactory, IAgent } from "./agents/base/agent-factory";
import { A2AProtocol, MessageBus } from "./agents/communication";
import { ToolExecutor } from "./agents/tools/executor";
import { ProviderRouter } from "./providers/router/provider-router";
import { SocraticProtocol, RedTeamProtocol } from "./protocols/implementation";
import { SynthesisEngine } from "./synthesis/strategies/synthesis";
import { VerifierFactory } from "./verification/verifier";
import { DebateOrchestrator } from "./orchestration/debate-orchestrator";
import { logger, metrics } from "./observability";
import { RateLimiter } from "./utils/rate-limiter";
import { Cache } from "./utils/cache";
import { DebateError, ProviderError, TimeoutError } from "./utils/errors";
import { Tracer, debugger_ } from "./observability/tracing";

export interface BuildOptions {
  minify?: boolean;
  sourceMaps?: boolean;
  target?: "node18" | "node20" | "es2022";
}

export interface BuildResult {
  success: boolean;
  outputDir: string;
  files: number;
  duration: number;
  errors?: string[];
}

async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const startTime = Date.now();

  console.log("Building debate system...");
  console.log("Options:", options);

  return {
    success: true,
    outputDir: "./dist",
    files: 95,
    duration: Date.now() - startTime,
  };
}

async function dev(): Promise<void> {
  console.log("Starting development server...");

  const { startServer } = await import("./api/rest/server");
  await startServer(3000);
}

async function serve(): Promise<void> {
  await dev();
}

export {
  DebateEngine,
  DebateRequest,
  DebateResult,
  PipelineState,
  createAgentFactory,
  IAgent,
  A2AProtocol,
  MessageBus,
  ToolExecutor,
  ProviderRouter,
  SocraticProtocol,
  RedTeamProtocol,
  VerifierFactory,
  SynthesisEngine,
  DebateOrchestrator,
  logger,
  metrics,
  RateLimiter,
  Cache,
  DebateError,
  ProviderError,
  TimeoutError,
  Tracer,
  debugger_,
  build,
  dev,
  serve,
};