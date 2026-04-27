import 'dotenv/config';
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { DebateEngine } from '../src/core/engine';
import { DebateRequest } from '../src/core/contracts/request';
import { ProviderRouter } from '../src/providers/router/provider-router';
import { GoogleProvider } from '../src/providers/google/gemini.provider';
import { OpenAIProvider } from '../src/providers/openai/openai.provider';
import { OpenRouterProvider } from '../src/providers/openrouter/openrouter.provider';
import { AnthropicProvider } from '../src/providers/anthropic/anthropic.provider';
import { logger } from '../src/observability/logging';
import { metrics } from '../src/observability/metrics';

const DEMO_QUERY = process.env.DEMO_QUERY || "What are the benefits of multi-agent AI systems?";

async function main() {
  console.log(`
╔═══════════════════════════════════════╗
║   Synthesis Debate System - Live Demo ║
╚═══════════════════════════════════════╝
  `);

  // Initialize providers
  const router = new ProviderRouter();

  if (process.env.GOOGLE_API_KEY) {
    const google = new GoogleProvider();
    await google.initialize(process.env.GOOGLE_API_KEY);
    router.register(google);
    console.log("✓ Google provider initialized");
  } else {
    console.log("⚠ GOOGLE_API_KEY not found in .env");
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAIProvider();
    await openai.initialize(process.env.OPENAI_API_KEY);
    router.register(openai);
    console.log("✓ OpenAI provider initialized");
  } else {
    console.log("⚠ OPENAI_API_KEY not found in .env");
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new AnthropicProvider();
    await anthropic.initialize(process.env.ANTHROPIC_API_KEY);
    router.register(anthropic);
    console.log("✓ Anthropic provider initialized");
  } else {
    console.log("⚠ ANTHROPIC_API_KEY not found in .env");
  }

  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = new OpenRouterProvider();
    await openrouter.initialize(process.env.OPENROUTER_API_KEY);
    router.register(openrouter);
    console.log("✓ OpenRouter provider initialized");
  } else {
    console.log("⚠ OPENROUTER_API_KEY not found in .env");
  }

  const availableProviders = router.getAllProviders().filter(p => p.isAvailable());
  console.log(`\n📦 Available providers: ${availableProviders.length}`);

  if (availableProviders.length === 0) {
    console.log("\n⚠ No API keys found. Add to .env file:");
    console.log("   GOOGLE_API_KEY=...");
    console.log("   OPENAI_API_KEY=...");
    console.log("   ANTHROPIC_API_KEY=...");
    console.log("   OPENROUTER_API_KEY=...");
    
    // Run with mock data for demo
    console.log("\n🔄 Running with mock responses...\n");
  }

  const engine = new DebateEngine({ maxRounds: 3 });
  
  // Pass provider router to engine so agents can use LLM
  if (availableProviders.length > 0) {
    engine.setProviderRouter(router);
  }

  const request: DebateRequest = {
    id: `demo-${Date.now()}`,
    query: DEMO_QUERY,
    metadata: {
      priority: "normal",
      source: "cli",
    },
  };

  console.log(`🤔 Query: ${request.query}\n`);

  const startTime = Date.now();

  try {
    const result = await engine.run(request);

    console.log(`
╔═══════════════════════════════════════╗
║           RESULT                        ║
╚═══════════════════════════════════════╝

📝 Answer:
${result.finalAnswer}

📊 Metrics:
   • Confidence: ${(result.confidence * 100).toFixed(1)}%
   • Rounds: ${result.metrics.totalRounds}
   • Cost: $${result.metrics.totalCost.toFixed(4)}
   • Time: ${(Date.now() - startTime) / 1000}s
    `);

    const finalMetrics = metrics.getMetrics();
    console.log(`
📈 System Metrics:
   • Total requests: ${finalMetrics.requestsTotal}
   • Success rate: ${((finalMetrics.requestsSuccess / finalMetrics.requestsTotal) * 100).toFixed(1)}%
   • Avg latency: ${finalMetrics.avgLatencyMs.toFixed(0)}ms
   • Total cost: $${finalMetrics.totalCost.toFixed(4)}
`);
  } catch (error) {
    logger.error("Demo failed", { error: String(error) });
    console.error(`\n❌ Error: ${error}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };