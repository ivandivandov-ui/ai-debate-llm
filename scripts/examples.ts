import { DebateEngine, DebateRequest } from "../src/core/engine";
import { SocraticProtocol, RedTeamProtocol } from "../src/protocols/implementation";
import { A2AProtocol, MessageBus, createMessage } from "../src/agents/communication";
import { ProviderRouter } from "../src/providers/router";
import { GoogleProvider, OpenAIProvider } from "../src/providers";
import { VerifierFactory } from "../src/verification/verifier";
import { logger } from "../src/observability/logging";

export async function example1SimpleDebate(): Promise<void> {
  console.log("=== Example 1: Simple Debate ===\n");

  const engine = new DebateEngine({ maxRounds: 3 });

  const request: DebateRequest = {
    id: "ex1",
    query: "Is climate change primarily caused by human activity?",
  };

  const result = await engine.run(request);

  console.log(`Q: ${result.query}`);
  console.log(`A: ${result.finalAnswer}`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%\n`);
}

export async function example2MultiProvider(): Promise<void> {
  console.log("=== Example 2: Multi-Provider ===\n");

  const router = new ProviderRouter();

  const google = new GoogleProvider();
  await google.initialize(process.env.GOOGLE_API_KEY || "demo");
  router.register(google);

  const openai = new OpenAIProvider();
  await openai.initialize(process.env.OPENAI_API_KEY || "demo");
  router.register(openai);

  const question = "What is the meaning of life?";

  console.log("Testing with different providers:\n");

  for (const provider of router.getAllProviders()) {
    const response = await provider.chat([
      { role: "user", content: question },
    ]);

    console.log(`${provider.name}: ${response.content.substring(0, 80)}...`);
    console.log(`Model: ${response.model}, Tokens: ${response.usage.totalTokens}\n`);
  }
}

export async function example3A2ACommunication(): Promise<void> {
  console.log("=== Example 3: A2A Communication ===\n");

  const protocol = new A2AProtocol();
  const bus = new MessageBus(protocol);

  const sessionId = "session-ex3" as any;

  protocol.setPolicy(sessionId, {
    turnLimit: { mode: "fixed", maxTurns: 3 },
    costGuard: { mode: "budget", maxBudget: 5 },
    roleAccess: { mode: "open" },
  });

  bus.subscribe("critic" as any, async (msg) => {
    logger.info(`Critic received: ${msg.content.substring(0, 50)}...`);
  });

  const msg = createMessage(
    "builder" as any,
    "critic" as any,
    "proposal",
    "I propose we implement a caching layer to improve performance.",
    "builder",
    sessionId
  );

  const result = await bus.send(msg);
  console.log(`Message sent: ${result.success ? "Success" : result.error}\n`);
}

export async function example4Verification(): Promise<void> {
  console.log("=== Example 4: Verification ===\n");

  const factual = VerifierFactory.createFactualVerifier();
  const safety = VerifierFactory.createSafetyVerifier();

  const testContent = "The Earth orbits around the Sun.";

  console.log(`Testing: "${testContent}"\n`);

  const factualResult = await factual.verify(testContent);
  console.log(`Factual: ${factualResult.passed ? "PASS" : "FAIL"} (confidence: ${factualResult.confidence})`);

  const safetyResult = await safety.verify(testContent);
  console.log(`Safety: ${safetyResult.passed ? "PASS" : "FAIL"}\n`);

  const dangerous = "<script>alert('xss')</script>";
  console.log(`Testing: "${dangerous}"`);

  const safetyDanger = await safety.verify(dangerous);
  console.log(`Safety: ${safetyDanger.passed ? "PASS" : "FAIL"} (${safetyDanger.errors?.join(", ")})\n`);
}

export async function example5Protocols(): Promise<void> {
  console.log("=== Example 5: Protocols ===\n");

  const protocols = [
    { name: "Socratic", protocol: new SocraticProtocol() },
    { name: "Red Team", protocol: new RedTeamProtocol() },
  ];

  for (const { name, protocol } of protocols) {
    console.log(`${name} Protocol:`);
    console.log(`  Max rounds: ${protocol.maxRounds}`);

    const participants = protocol.getParticipants({} as any);
    console.log(`  Participants: ${participants.length}`);

    const decision = protocol.getNextTurn({ round: 0, phase: "opening", history: [], proposals: [], positions: new Map() } as any);
    console.log(`  First action: ${decision.suggestedAction}\n`);
  }
}

export async function example6FullPipeline(): Promise<void> {
  console.log("=== Example 6: Full Pipeline ===\n");

  const engine = new DebateEngine({ maxRounds: 5 });

  const requests: DebateRequest[] = [
    { id: "1", query: "What is AI?" },
    { id: "2", query: "Compare Python and JavaScript" },
    { id: "3", query: "Explain quantum computing" },
  ];

  for (const request of requests) {
    console.log(`Processing: ${request.query}`);

    const result = await engine.run(request);

    console.log(`  Answer: ${result.finalAnswer.substring(0, 60)}...`);
    console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`  Rounds: ${result.metrics.totalRounds}`);
    console.log(`  Cost: $${result.metrics.totalCost.toFixed(4)}\n`);
  }
}

async function runAll() {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   Debate System Examples            ║");
  console.log("╚═══════════════════════════════════════╝\n");

  try {
    await example1SimpleDebate();
    await example2MultiProvider();
    await example3A2ACommunication();
    await example4Verification();
    await example5Protocols();
    await example6FullPipeline();

    console.log("All examples completed!");
  } catch (error) {
    logger.error("Example failed", { error: String(error) });
    console.error(error);
  }
}

if (require.main === module) {
  runAll();
}

export {
  example1SimpleDebate,
  example2MultiProvider,
  example3A2ACommunication,
  example4Verification,
  example5Protocols,
  example6FullPipeline,
};