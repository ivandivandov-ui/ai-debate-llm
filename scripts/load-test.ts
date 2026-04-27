import { DebateRequest } from "../src/core/contracts/request";
import { logger } from "../src/observability/logging";

export interface LoadTestConfig {
  totalRequests: number;
  concurrency: number;
  timeout: number;
}

export interface LoadTestResult {
  totalRequests: number;
  successful: number;
  failed: number;
  duration: number;
  throughput: number;
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
}

export async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  console.log(`Running load test: ${config.totalRequests} requests, ${config.concurrency} concurrent`);
  
  const { DebateOrchestrator } = await import("../src/orchestration/debate-orchestrator");
  
  const orchestrator = new DebateOrchestrator({ maxConcurrentSessions: config.concurrency });
  
  const latencies: number[] = [];
  let successful = 0;
  let failed = 0;

  const startTime = Date.now();
  let completed = 0;

  const promises: Promise<void>[] = [];

  for (let i = 0; i < config.totalRequests; i++) {
    const request: DebateRequest = {
      id: `load-test-${i}`,
      query: "What is artificial intelligence?",
    };

    const promise = (async () => {
      const reqStart = Date.now();
      
      try {
        await Promise.race([
          orchestrator.run(request),
          new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), config.timeout)),
        ]);
        
        successful++;
        latencies.push(Date.now() - reqStart);
      } catch (error) {
        failed++;
        logger.error("Load test request failed", { error: String(error) });
      }
      
      completed++;
      
      if (completed % 10 === 0) {
        console.log(`Progress: ${completed}/${config.totalRequests}`);
      }
    })();

    if (i >= config.concurrency) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    promises.push(promise);
  }

  await Promise.all(promises);

  const duration = Date.now() - startTime;
  const throughput = (config.totalRequests / duration) * 1000;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  const result: LoadTestResult = {
    totalRequests: config.totalRequests,
    successful,
    failed,
    duration,
    throughput,
    avgLatency,
    p50,
    p95,
    p99,
  };

  console.log(`
╔══════════════════════════════════════╗
║         Load Test Results          ║
╠══════════════════════════════════════╣
║ Total Requests:  ${config.totalRequests.toString().padEnd(21)}║
║ Successful:     ${successful.toString().padEnd(21)}║
║ Failed:         ${failed.toString().padEnd(21)}║
║ Duration:       ${duration.toString().padEnd(21)}║
║ Throughput:      ${throughput.toFixed(2).padEnd(21)}║
║ Avg Latency:     ${avgLatency.toFixed(0).padEnd(21)}║
║ P50:            ${p50.toString().padEnd(21)}║
║ P95:            ${p95.toString().padEnd(21)}║
║ P99:            ${p99.toString().padEnd(21)}║
╚══════════════════════════════════════╝
  `);

  return result;
}

async function main() {
  const config: LoadTestConfig = {
    totalRequests: 50,
    concurrency: 10,
    timeout: 60000,
  };

  await runLoadTest(config);
}

if (require.main === module) {
  main();
}

export { runLoadTest, LoadTestConfig, LoadTestResult };