import { DebateRequest } from "../src/core/contracts/request";
import { DebateOrchestrator } from "../src/orchestration/debate-orchestrator";
import { logger } from "../src/observability/logging";

const SCENARIOS = [
  {
    name: "Simple Question",
    query: "What is 2+2?",
    expectedRounds: 1,
  },
  {
    name: "Build Request",
    query: "Build a function to calculate fibonacci",
    expectedRounds: 2,
  },
  {
    name: "Comparison",
    query: "Compare Python vs JavaScript for web development",
    expectedRounds: 3,
  },
  {
    name: "Verification",
    query: "Verify that the earth is round",
    expectedRounds: 2,
  },
  {
    name: "Complex Analysis",
    query: "Analyze the pros and cons of artificial general intelligence",
    expectedRounds: 5,
  },
];

async function runScenario(
  name: string,
  query: string,
  expectedRounds: number
): Promise<void> {
  console.log(`\n📋 Scenario: ${name}`);
  console.log(`   Query: "${query}"`);
  console.log(`   Expected rounds: ${expectedRounds}`);

  const start = Date.now();

  try {
    const orchestrator = new DebateOrchestrator({
      maxConcurrentSessions: 10,
      sessionTimeout: 60000,
    });

    const request: DebateRequest = {
      id: `sim-${Date.now()}`,
      query,
      metadata: {
        source: "simulation",
        priority: "normal",
      },
    };

    const result = await orchestrator.run(request);
    const duration = Date.now() - start;

    console.log(`\n   ✓ Completed in ${duration}ms`);
    console.log(`   Rounds: ${result.metrics.totalRounds}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Cost: $${result.metrics.totalCost.toFixed(4)}`);
    console.log(`\n   Answer: ${result.finalAnswer.substring(0, 100)}...`);

    logger.info(`Scenario completed`, {
      name,
      duration,
      rounds: result.metrics.totalRounds,
      confidence: result.confidence,
    });
  } catch (error) {
    console.log(`\n   ✗ Failed: ${error}`);
    logger.error(`Scenario failed`, { name, error: String(error) });
  }
}

async function simulateAll() {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   Debate Simulation Suite        ║");
  console.log("╚═══════════════════════════════════════╝");

  console.log(`\nRunning ${SCENARIOS.length} scenarios...\n`);

  for (const scenario of SCENARIOS) {
    await runScenario(scenario.name, scenario.query, scenario.expectedRounds);
  }

  console.log("\n" + "═".repeat(50));
  console.log("All simulations complete!");
}

if (require.main === module) {
  simulateAll();
}

export { simulateAll, runScenario, SCENARIOS };