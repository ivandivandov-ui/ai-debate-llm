# Synthesis Debate System

Multi-agent debate system with A2A and MCP layers for AI-powered reasoning.

## Features

- **Multi-Agent Architecture** — 5 specialized agents (Builder, Critic, Skeptic, Scientist, Verifier)
- **A2A Communication** — Inter-agent messaging with policies (turn limits, cost guards, role access)
- **MCP Tools** — Extensible tool system (search, code, math, db)
- **Multiple Providers** — Google, OpenRouter, Anthropic, OpenAI with smart routing
- **4 Debate Protocols** — Socratic, Adversarial, Red-Team, Consensus
- **Smart Verification** — Factual, logical, consistency, safety + cross-reference
- **Adaptive Decision Engine** — Uncertainty tracking, saturation detection, contradiction handling
- **Memory** — Short-term and long-term memory with retrieval
- **REST API** — Built-in HTTP server
- **Observability** — Logging, metrics, tracing

## Key Capabilities (NEW)

### DecisionStage
- Uncertainty scoring (6 sources: conflicting_evidence, insufficient_data, logical_gaps, etc.)
- Adaptive stop conditions: max_rounds, convergence, saturation, contradiction, uncertainty
- Allow "no answer" when insufficient evidence

## Key Capabilities (NEW)

### DecisionStage
- Uncertainty scoring (6 sources: conflicting_evidence, insufficient_data, logical_gaps, etc.)
- Adaptive stop conditions: max_rounds, convergence, saturation, contradiction, uncertainty
- Allow "no answer" when insufficient evidence

### VerifyStage
- Factual: absolute terms detection, hedging, cross-reference checks
- Logical: circular reasoning, causal claims without justification
- Consistency: cross-reference validation between results
- Safety: XSS, code injection, SQL injection patterns

### Frontend UI/UX
- **Modern React Interface** — TypeScript + Tailwind CSS
- **Real-time Debate Visualization** — Live updates and agent interactions
- **Protocol Selection** — Choose debate protocols with descriptions
- **Debate History** — Browse and review past debates
- **Settings Management** — Configure API keys and system parameters

### FuseStage
- Preserve contradictions (don't smooth over conflicts)
- Detect partial agreement
- Allow `CONFLICT_DETECTED` response

## Quick Start

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Start both servers
./start.sh

# Or start individually:
npm run start          # Backend on :3000
cd frontend && npm run dev  # Frontend on :5173
```

## Architecture

```
src/                    # Backend (Node.js/TypeScript)
├── core/               # Engine + Pipeline + Contracts
├── agents/             # 5 specialized agents
├── providers/          # AI provider integrations
├── api/                # REST API endpoints
└── ...

frontend/               # Frontend (React/TypeScript)
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Dashboard, Debate, Settings, History
│   ├── types.ts       # TypeScript definitions
│   └── utils/         # API client and utilities
└── ...
```
│   ├── pipeline/     # 9 stages with smart decision making
│   ├── contracts/    # TypeScript interfaces
│   └── runtime/     # LangGraph adapters
│
├── agents/           # Agent system
│   ├── base/        # Interface, Runner, Factory
│   ├── roles/      # 5 role agents
│   ├── cognitive/  # Fast/Slow/Creative
│   ├── communication/ # A2A layer
│   └── tools/      # MCP layer
│
├── providers/       # LLM providers
├── protocols/      # Debate protocols
├── verification/  # Smart verification
├── synthesis/    # Contradiction-aware synthesis
├── memory/       # Memory system
├── orchestration/ # Orchestrator
├── api/          # REST, WebSocket, GraphQL
└── observability/ # Logging, metrics, tracing
```

## Configuration

Create `.env`:
```bash
GOOGLE_API_KEY=your_key
OPENROUTER_API_KEY=your_key
```

Or use `config/system.json`.

## License

MIT