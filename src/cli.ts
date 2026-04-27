#!/usr/bin/env node

import "dotenv/config";
import { DebateEngine, DebateRequest } from "./core/engine";
import { logger } from "./observability/logging";
import { metrics } from "./observability/metrics";
import * as readline from "readline";

interface CLICommand {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<void>;
}

const commands: CLICommand[] = [
  {
    name: "debate",
    description: "Run a debate query",
    execute: async (args) => {
      const query = args.join(" ");
      if (!query) {
        console.log("Error: Query required");
        return;
      }

      const { ProviderRouter } = await import("./providers/router/provider-router");
      const { getAllApiKeys } = await import("./persistence/database");
      
      const dbApiKeysMetadata = await getAllApiKeys();
      const router = new ProviderRouter();
      
      const providerConfigs = [
        { name: "google", env: "GOOGLE_API_KEY", path: "./providers/google/gemini.provider", class: "GoogleProvider" },
        { name: "openrouter", env: "OPENROUTER_API_KEY", path: "./providers/openrouter/openrouter.provider", class: "OpenRouterProvider" },
        { name: "groq", env: "GROQ_API_KEY", path: "./providers/groq/groq.provider", class: "GroqProvider" },
        { name: "anthropic", env: "ANTHROPIC_API_KEY", path: "./providers/anthropic/anthropic.provider", class: "AnthropicProvider" },
        { name: "openai", env: "OPENAI_API_KEY", path: "./providers/openai/openai.provider", class: "OpenAIProvider" },
      ];

      for (const config of providerConfigs) {
        const apiKey = dbApiKeysMetadata[config.name]?.key || process.env[config.env];
        if (apiKey) {
          try {
            const module = await import(config.path);
            const ProviderClass = module[config.class];
            const provider = new ProviderClass();
            await provider.initialize(apiKey);
            router.register(provider);
            console.log(`✓ ${config.name} provider initialized`);
          } catch (e) {
            console.error(`✗ Failed to initialize ${config.name}:`, e instanceof Error ? e.message : String(e));
          }
        }
      }

      if (router.getAllProviders().length === 0) {
        console.error("Error: No providers available. Set API keys in .env or via 'keys set' command.");
        return;
      }

      const engine = new DebateEngine({ maxRounds: 5 });
      engine.setProviderRouter(router);
      
      const request: DebateRequest = {
        id: `cli-${Date.now()}`,
        query,
      };

      console.log(`\n🤔 Query: ${query}\n`);
      const result = await engine.run(request);

      console.log(`\n📝 Answer: ${result.finalAnswer}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Rounds: ${result.metrics.totalRounds}`);
      console.log(`   Cost: $${result.metrics.totalCost.toFixed(4)}\n`);
    },
  },
  {
    name: "providers",
    description: "List available providers",
    execute: async () => {
      const { ProviderRouter } = await import("./providers/router/provider-router");
      const { GoogleProvider } = await import("./providers/google/gemini.provider");
      const { OpenRouterProvider } = await import("./providers/openrouter/openrouter.provider");
      const { AnthropicProvider } = await import("./providers/anthropic/anthropic.provider");
      const { OpenAIProvider } = await import("./providers/openai/openai.provider");

      const router = new ProviderRouter();
      router.register(new GoogleProvider());
      router.register(new OpenRouterProvider());
      router.register(new AnthropicProvider());
      router.register(new OpenAIProvider());

      console.log("\n📦 Available Providers:\n");
      const all = router.getAllProviders();
      for (const p of all) {
        console.log(`  - ${p.name}: ${p.availableModels.slice(0, 3).join(", ")}`);
      }
      console.log();
    },
  },
  {
    name: "agents",
    description: "List available agents",
    execute: async () => {
      console.log(`
🤖 Available Agents:

  builder   - Constructs solutions
  critic    - Finds flaws
  skeptic   - Questions assumptions
  scientist - Researches thoroughly
  verifier  - Verifies facts

🧠 Cognitive Types:

  fast     - Quick, intuitive
  slow     - Deep, thorough
  creative - Novel, inventive
`);
    },
  },
  {
    name: "metrics",
    description: "Show system metrics",
    execute: async () => {
      const stats = metrics.getMetrics();
      console.log(`
📊 System Metrics:

  Requests:    ${stats.requestsTotal} (${stats.requestsSuccess} success, ${stats.requestsFailed} failed)
  Avg Latency: ${stats.avgLatencyMs.toFixed(0)}ms
  Avg Tokens:  ${stats.avgTokens.toFixed(0)}
  Total Cost:  $${stats.totalCost.toFixed(4)}
`);
    },
  },
  {
    name: "clear",
    description: "Clear metrics",
    execute: async () => {
      metrics.reset();
      console.log("✅ Metrics cleared\n");
    },
  },
  {
    name: "help",
    description: "Show this help",
    execute: async () => {
      console.log(`
📖 Commands:

  debate <query>      - Run a debate
  providers            - List providers
  agents               - List agents
  metrics              - Show metrics
  keys set <p> <k>     - Set API key for provider
  keys list            - List stored API keys
  clear                - Clear metrics
  help                 - Show help
  quit                 - Exit

Shortcuts:
  /d <query>          - Short for debate
  /m                  - Short for metrics
  /q                  - Short for quit
`);
    },
  },
  {
    name: "keys",
    description: "Manage API keys",
    execute: async (args) => {
      const { saveApiKey, getAllApiKeys, deleteApiKey } = await import("./persistence/database");
      const sub = args[0]?.toLowerCase();

      if (sub === "set") {
        const provider = args[1]?.toLowerCase();
        const key = args[2];
        if (!provider || !key) {
          console.log("Usage: keys set <provider> <key>");
          return;
        }
        await saveApiKey(provider, key);
        console.log(`✅ Key for ${provider} saved to database`);
      } else if (sub === "list") {
        const keysMetadata = await getAllApiKeys();
        console.log("\n🔑 Stored API Keys:\n");
        Object.entries(keysMetadata).forEach(([p, info]) => {
          const key = info.key;
          const masked = key.substring(0, 8) + "..." + (key.length > 4 ? key.substring(key.length - 4) : "");
          console.log(`  - ${p}: ${masked} [${info.status}]`);
        });
        if (Object.keys(keysMetadata).length === 0) console.log("  (No keys stored in database)");
        console.log();
      } else if (sub === "delete") {
        const provider = args[1]?.toLowerCase();
        if (!provider) {
          console.log("Usage: keys delete <provider>");
          return;
        }
        await deleteApiKey(provider);
        console.log(`✅ Key for ${provider} deleted`);
      } else {
        console.log("Usage: keys [set|list|delete]");
      }
    },
  },
];

async function runCommand(input: string): Promise<void> {
  const trimmed = input.trim();
  if (!trimmed) return;

  if (trimmed.startsWith("/d ")) {
    await commands[0].execute([trimmed.substring(3)]);
    return;
  }

  if (trimmed === "/m") {
    await commands[3].execute([]);
    return;
  }

  if (trimmed === "/q") {
    process.exit(0);
  }

  const parts = trimmed.split(" ");
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const cmd = commands.find((c) => c.name === cmdName);
  if (cmd) {
    await cmd.execute(args);
  } else {
    console.log(`Unknown command: ${cmdName}. Type "help" for available commands.`);
  }
}

async function interactive(): Promise<void> {
  console.log(`
╔═══════════════════════════════════════╗
║   Debate System CLI                 ║
║   Type "help" for commands          ║
║   Type "/q" to quit                 ║
╚═══════════════════════════════════════╝
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question("> ", async (input) => {
      try {
        await runCommand(input);
      } catch (error) {
        logger.error("Command failed", { error: String(error) });
        console.log(`Error: ${error}`);
      }
      prompt();
    });
  };

  prompt();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await interactive();
  } else {
    await runCommand(args.join(" "));
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { runCommand, commands };