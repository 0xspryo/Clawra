# CLAWRA

A dual-purpose Solana application combining wallet management tools with an autonomous AI agent evolution system.

---

## Features

### Wallet Distributor
- **Auto-generate** Solana developer wallets (keypair generation)
- **Check SOL balance** for any wallet
- **Distribute SOL** proportionally across multiple newly-generated wallets
- **Withdraw/Sweep** — collect all distributed SOL back to a single destination address
- **Network toggle** — switch between Solana mainnet and devnet
- **Export wallets** — copy to clipboard or download as JSON

### CLAWRA (Closed-Loop Autonomous Wallet & Redistribution Architecture)
- **Agent Spawning** — autonomous trading agents with randomized strategies (momentum, mean reversion, sniper, arbitrage, sentiment, liquidity tracking, meme velocity)
- **Simulated Trading** — agents execute trades across Solana tokens (SOL, BONK, WIF, JUP, PYTH, RAY, ORCA, and more)
- **Evolution Engine** — genetic evolution cycles that evaluate agent performance, eliminate the weakest 30%, and clone the top 20% with parameter mutations
- **Lineage Tracking** — full parent-child lineage tree across generations with mutation history
- **Performance Analytics** — leaderboards, strategy comparison, token-level P&L, risk distribution, and generation stats
- **Live Dashboard** — real-time control center with activity feed, trade log, and evolution history

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express.js |
| Database | PostgreSQL with Drizzle ORM |
| Blockchain | @solana/web3.js, bs58 |
| State Management | TanStack React Query |
| Routing | Wouter |

---

## Project Structure

```
├── client/src/
│   ├── pages/
│   │   ├── home.tsx                 # Wallet distributor UI
│   │   ├── clawra-dashboard.tsx     # CLAWRA control center
│   │   ├── clawra-agents.tsx        # Agent registry + detail views
│   │   ├── clawra-evolution.tsx     # Lineage tree + mutation history
│   │   └── clawra-analytics.tsx     # Performance analytics
│   ├── App.tsx                      # Sidebar navigation + routing
│   └── lib/queryClient.ts           # API client setup
├── server/
│   ├── routes.ts                    # All API endpoints
│   ├── storage.ts                   # Database interface (Drizzle)
│   └── simulation.ts               # Agent engine + evolution logic
├── shared/
│   └── schema.ts                    # Database schema + validation types
└── drizzle.config.ts
```

---

## API Endpoints

### Wallet Tools
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate-wallet` | Generate a new Solana keypair |
| POST | `/api/balance` | Check SOL balance |
| POST | `/api/distribute` | Distribute SOL across N wallets |
| POST | `/api/withdraw` | Sweep SOL back to a destination |

### CLAWRA System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clawra/dashboard` | Dashboard statistics |
| GET | `/api/clawra/agents` | List all agents (keys excluded) |
| GET | `/api/clawra/agents/:id` | Agent detail with trades & mutations |
| POST | `/api/clawra/agents/spawn` | Spawn a new agent |
| POST | `/api/clawra/evolve` | Run an evolution cycle |
| GET | `/api/clawra/trades` | Recent trade history |
| GET | `/api/clawra/cycles` | Evolution cycle history |
| GET | `/api/clawra/mutations` | Mutation records |
| GET | `/api/clawra/activity` | System activity feed |
| GET | `/api/clawra/lineage` | Lineage tree data |

---

## How CLAWRA Works

1. **Spawn** — Agents are created with random strategies, risk profiles, position sizes, and trade parameters. Each agent gets a unique Solana wallet.

2. **Simulate** — Agents execute simulated trades based on their strategy and parameters. Performance is measured by P&L, win rate, drawdown, and capital efficiency.

3. **Evaluate** — A composite performance score is calculated:
   - 35% total P&L
   - 25% win rate
   - 20% drawdown resistance
   - 20% capital efficiency

4. **Evolve** — Each evolution cycle:
   - Bottom 30% of agents are eliminated
   - Top 20% are cloned with genetic mutations (risk profile, position size, trade frequency, signal threshold)
   - One completely new random agent is introduced
   - All mutations are recorded for lineage tracking

5. **Repeat** — Over successive cycles, successful strategies propagate and refine through natural selection.

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
# DATABASE_URL=your_postgresql_connection_string

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`.

On first run, the system automatically seeds 12 initial agents and runs 8 evolution cycles to populate the dashboard with data.

---

## Security

- Agent wallet private keys are stored server-side only and are **never exposed** through API responses
- All CLAWRA API endpoints return sanitized agent data (wallet address only)
- Wallet distributor private keys are handled in-memory and never persisted

---

## License

MIT
