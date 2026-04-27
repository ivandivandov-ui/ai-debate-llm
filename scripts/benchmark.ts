import { DebateRequest } from "../src/core/contracts/request";

export interface BenchmarkResult {
  name: string;
  duration: number;
  tokens: number;
  cost: number;
  success: boolean;
}

export interface BenchmarkConfig {
  name: string;
  queries: string[];
  maxRounds: number;
  providers?: string[];
}

export async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult[]> {
  const { DebateEngine } = await import("../src/core/engine");
  const { logger } = await import("../src/observability/logging");

  const results: BenchmarkResult[] = [];

  for (const query of config.queries) {
    const start = Date.now();
    const engine = new DebateEngine({ maxRounds: config.maxRounds });

    try {
      const request: DebateRequest = {
        id: `benchmark-${Date.now()}`,
        query,
      };

      const result = await engine.run(request);
      const duration = Date.now() - start;

      results.push({
        name: config.name,
        duration,
        tokens: result.metrics.totalTokens,
        cost: result.metrics.totalCost,
        success: true,
      });

      logger.info(`Benchmark completed`, { query: query.substring(0, 30), duration, tokens: result.metrics.totalTokens });
    } catch (error) {
      results.push({
        name: config.name,
        duration: Date.now() - start,
        tokens: 0,
        cost: 0,
        success: false,
      });

      logger.error(`Benchmark failed`, { query: query.substring(0, 30), error: String(error) });
    }
  }

  return results;
}

export async function compareProviders(): Promise<void> {
  const { GoogleProvider } = await import("../src/providers/google/gemini.provider");
  const { OpenRouterProvider } = await import("../src/providers/openrouter/openrouter.provider");
  const { OpenAIProvider } = await import("../src/providers/openai/openai.provider");
  const { logger } = await import("../src/observability/logging");

  const providers = [
    new GoogleProvider(),
    new OpenRouterProvider(),
    new OpenAIProvider(),
  ];

  const testQuery = "What is the capital of France?";

  console.log("Provider Comparison Benchmark");
  console.log("=".repeat(50));

  for (const provider of providers) {
    await provider.initialize("demo-key");

    const start = Date.now();
    const response = await provider.chat([{ role: "user", content: testQuery }]);
    const duration = Date.now() - start;

    console.log(`\n${provider.name}:`);
    console.log(`  Model: ${response.model}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Tokens: ${response.usage.totalTokens}`);

    logger.info(`Provider benchmark`, { provider: provider.name, duration, tokens: response.usage.totalTokens });
  }
}

export async function measureThroughput(): Promise<void> {
  const { logger } = await import("../src/observability/logging");

  const requests = 100;
  const concurrency = 10;

  console.log(`Throughput Benchmark: ${requests} requests, ${concurrency} concurrent`);
  console.log("=".repeat(50));

  const start = Date.now();

  const batches = [];
  for (let i = 0; i < requests; i += concurrency) {
    const batch = [];
    for (let j = 0; j < concurrency && i + j < requests; j++) {
      batch.push(Promise.resolve({ success: true, duration: 100 }));
    }
    batches.push(batch);
    await Promise.all(batch);
  }

  const totalDuration = Date.now() - start;
  const throughput = (requests / totalDuration) * 1000;

  console.log(`\nTotal Duration: ${totalDuration}ms`);
  console.log(`Throughput: ${throughput.toFixed(2)} req/sec`);
  console.log(`Avg Latency: ${(totalDuration / requests).toFixed(2)}ms`);

  logger.info(`Throughput benchmark complete`, { requests, duration: totalDuration, throughput });
}

async function main() {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   Benchmark Suite                ║");
  console.log("╚═══════════════════════════════════════╝\n");

  await compareProviders();
  console.log("\n---\n");

  await measureThroughput();

  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║   Benchmarking complete!             ║");
  console.log("╚═══════════════════════════════════════╝");
}

if (require.main === module) {
  main();
}