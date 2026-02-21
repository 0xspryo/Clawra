# OpenClaw Agent

**Autonomous Closed-Loop Trading Agent Evolution on Solana**

OpenClaw is an autonomous agent framework that spawns, evaluates, and evolves populations of AI trading agents on the Solana blockchain. It uses genetic algorithm-based natural selection to discover optimal trading parameter configurations across generations — no human intervention required.

---

## What It Does

OpenClaw runs a continuous autonomous evolution loop:

1. **Spawn** — Agents are created with unique Solana wallets and randomized trading parameters
2. **Simulate** — Each agent executes trades across Solana ecosystem tokens (SOL, BONK, WIF, JUP, PYTH, RAY, ORCA, etc.)
3. **Evaluate** — A multi-factor fitness function scores each agent on profitability, consistency, risk management, and capital efficiency
4. **Evolve** — Bottom 30% are eliminated, top 20% are cloned with parameter mutations, and random agents are injected for genetic diversity
5. **Repeat** — The cycle continues autonomously, with each generation producing agents better adapted to market conditions

Over time, the population converges on parameter combinations that produce consistent returns while maintaining diversity through controlled randomness.

---

## Key Features

- **Autonomous Evolution** — No manual tuning. The genetic algorithm discovers optimal configurations through natural selection pressure
- **Real Solana Wallets** — Each agent gets a unique Ed25519 keypair. The framework is blockchain-native from the ground up
- **Multi-Strategy Support** — Agents can combine up to 3 strategies: momentum, mean reversion, sentiment analysis, sniping, arbitrage, liquidity tracking, meme velocity
- **Composite Fitness Scoring** — Agents aren't ranked on raw P&L alone. The fitness function weighs profitability (35%), win rate (25%), drawdown resistance (20%), and capital efficiency (20%)
- **Mutation with Memory** — Every parameter change during cloning is recorded. Full lineage trees show how strategies evolved across generations
- **Live Dashboard** — Real-time monitoring of agent populations, trade activity, evolution cycles, and performance analytics
- **Wallet Distribution Tools** — Built-in utilities for SOL distribution and fund sweeping across agent wallets

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     OpenClaw Agent Core                       │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Spawner     │  │  Simulator   │  │  Evolution Engine  │  │
│  │  - Keypair   │  │  - Trades    │  │  - Fitness eval    │  │
│  │  - Params    │  │  - P&L calc  │  │  - Selection       │  │
│  │  - Strategy  │  │  - Markets   │  │  - Cloning         │  │
│  │    selection │  │              │  │  - Mutation         │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                   │
│                  ┌───────┴───────┐                           │
│                  │   PostgreSQL  │                           │
│                  │   (Drizzle)   │                           │
│                  └───────────────┘                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Dashboard & Analytics UI                    │ │
│  │  React + Vite + shadcn/ui + TanStack Query              │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical deep-dive including algorithm specifics, data models, and API documentation.

---

## Agent Parameters

Each agent is defined by these evolvable parameters:

| Parameter | Range | What It Controls |
|-----------|-------|-----------------|
| `riskProfile` | 0.1 – 0.9 | Trade volatility exposure |
| `positionSize` | 0.01 – 0.5 | Capital fraction per trade |
| `tradeFrequency` | 0.1 – 1.0 | Trades per simulation tick |
| `signalThreshold` | 0.2 – 0.9 | Confidence needed to enter |
| `strategy[]` | 1–3 strategies | Trading approach combination |
| `assetPreference` | Token symbol | Primary market |

During evolution, these parameters undergo bounded uniform random mutation (±15% for most, ±7.5% for position sizing) with a 20% chance of strategy crossover.

---

## Fitness Function

Agents are scored using a weighted composite:

```
fitness = 0.35 × normalized_pnl
        + 0.25 × win_rate
        + 0.20 × drawdown_resistance
        + 0.20 × capital_efficiency
```

This formula rewards agents that are profitable AND consistent, while penalizing those with catastrophic losses even if their average returns are high.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Solana wallet (for distribution tools)

### Installation

```bash
git clone https://github.com/your-org/openclaw-agent.git
cd openclaw-agent
npm install
```

### Environment

Create a `.env` file (see `.env.example`):

```
DATABASE_URL=postgresql://user:password@host:5432/openclaw
SESSION_SECRET=your-session-secret
```

### Run

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5000`.

On first run, OpenClaw automatically seeds 12 origin agents and runs 8 evolution cycles to build an initial population with lineage history.

---

## Project Structure

```
├── server/
│   ├── simulation.ts      # Core evolution engine (spawn, trade, evaluate, evolve)
│   ├── storage.ts          # Database storage layer (Drizzle ORM)
│   ├── routes.ts           # REST API endpoints
│   └── index.ts            # Server entry point
├── client/
│   └── src/
│       ├── pages/
│       │   ├── home.tsx              # Wallet distribution tools
│       │   ├── clawra-dashboard.tsx  # Agent control center
│       │   ├── clawra-agents.tsx     # Agent registry & detail views
│       │   ├── clawra-evolution.tsx  # Lineage tree & mutation history
│       │   └── clawra-analytics.tsx  # Performance analytics
│       └── App.tsx                   # Sidebar navigation & routing
├── shared/
│   └── schema.ts           # Database schema & validation types
├── docs/
│   ├── EVOLUTION.md        # Evolution algorithm deep-dive
│   └── AGENT_LIFECYCLE.md  # Agent lifecycle documentation
├── ARCHITECTURE.md         # System architecture overview
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # Contribution guidelines
└── LICENSE                 # MIT License
```

---

## API Overview

### Agent Evolution

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clawra/agents/spawn` | POST | Spawn a new random agent |
| `/api/clawra/evolve` | POST | Run one evolution cycle |
| `/api/clawra/dashboard` | GET | Population stats |
| `/api/clawra/agents` | GET | All agents (keys excluded) |
| `/api/clawra/agents/:id` | GET | Agent detail with trades & mutations |
| `/api/clawra/lineage` | GET | Lineage tree data |

### Wallet Tools

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-wallet` | POST | Generate Solana keypair |
| `/api/balance` | POST | Check SOL balance |
| `/api/distribute` | POST | Distribute SOL to N wallets |
| `/api/withdraw` | POST | Sweep funds to destination |

Full API documentation in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Security

- Agent wallet private keys are stored server-side only and never exposed through API responses
- All agent data returned to clients passes through `sanitizeAgent()` which strips the `walletPrivateKey` field
- The lineage endpoint returns only safe fields (id, name, score, strategy, status)
- Wallet distributor private keys are handled in-memory and never persisted

---

## License

MIT — see [LICENSE](./LICENSE)
