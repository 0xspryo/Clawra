# OpenClaw Architecture

## System Overview

OpenClaw (Closed-Loop Autonomous Wallet & Redistribution Architecture) is a genetic algorithm-based autonomous agent evolution system built on Solana. It spawns trading agents with unique parameter configurations, simulates market activity, evaluates fitness, and evolves the population through natural selection.

This document describes the core algorithms, data flow, and design decisions.

---

## Genetic Algorithm Design

### Population Model

The system maintains a population of autonomous trading agents. Each agent is defined by:

| Parameter | Range | Description |
|-----------|-------|-------------|
| `riskProfile` | 0.1 - 0.9 | Appetite for volatility (maps to trade price swing range) |
| `positionSize` | 0.01 - 0.5 | Fraction of capital deployed per trade |
| `tradeFrequency` | 0.1 - 1.0 | Number of trades executed per simulation tick |
| `signalThreshold` | 0.2 - 0.9 | Minimum confidence required to enter a position |
| `strategy[]` | 1-3 strategies | Trading approach(es): momentum, mean_reversion, sentiment, sniper, arbitrage, liquidity_tracking, meme_velocity |
| `assetPreference` | Token symbol | Primary token market (SOL, BONK, WIF, JUP, PYTH, RAY, ORCA, MNGO, STEP, SRM) |

### Evolution Cycle

Each evolution cycle follows these phases:

```
┌─────────────────────────────────────────────────────────────┐
│                    EVOLUTION CYCLE                           │
│                                                             │
│  1. TRADE     All active agents execute simulated trades    │
│       ↓                                                     │
│  2. EVALUATE  Fitness scores recalculated for each agent    │
│       ↓                                                     │
│  3. RANK      Agents sorted by composite fitness score      │
│       ↓                                                     │
│  4. SELECT    Bottom 30% eliminated, top 20% cloned         │
│       ↓                                                     │
│  5. MUTATE    Cloned offspring receive parameter mutations  │
│       ↓                                                     │
│  6. INJECT    1 random agent added for genetic diversity    │
└─────────────────────────────────────────────────────────────┘
```

### Fitness Function

Agent fitness is a weighted composite of four metrics:

```
score = 0.35 × normalized_pnl
      + 0.25 × win_rate
      + 0.20 × drawdown_inverse
      + 0.20 × capital_efficiency
```

| Component | Calculation | Purpose |
|-----------|------------|---------|
| `normalized_pnl` | `clamp(total_pnl / 10, -1, 1)` | Rewards absolute profitability |
| `win_rate` | `winning_trades / total_trades` | Rewards consistency |
| `drawdown_inverse` | `1 / (1 + max_single_loss)` | Penalizes catastrophic losses |
| `capital_efficiency` | `clamp(total_pnl / capital, -1, 1)` | Rewards returns per unit capital |

The weights were chosen to balance aggression vs. sustainability:
- P&L has the highest weight (0.35) because profitability is the ultimate objective
- Win rate (0.25) prevents agents that win big occasionally but lose constantly
- Drawdown inverse (0.20) penalizes agents with catastrophic single-trade losses
- Capital efficiency (0.20) rewards agents that achieve returns with less capital

### Mutation Model

When a high-performing agent is cloned, its parameters undergo bounded uniform random perturbation:

```
new_value = parent_value + uniform_random(-mutation_rate, +mutation_rate)
```

- Base mutation rate: ±15% for most parameters
- Position size uses half rate (±7.5%) for capital stability
- Values are clamped to valid ranges after mutation
- 20% chance of strategy crossover (adding/replacing a strategy)
- 80% chance of inheriting parent's asset preference

### Selection Pressure

The 30/20/1 selection ratio creates specific population dynamics:

- **Kill 30%**: Strong enough to remove consistently poor strategies
- **Clone 20%**: Propagates successful parameter combinations
- **Inject 1**: Maintains genetic diversity, prevents premature convergence
- Net effect: Population grows slowly, allowing lineage trees to develop

---

## Trade Simulation Model

Trades are generated with realistic market dynamics:

```
volatility = 0.02 + risk_profile × 0.08     (range: 2-10%)
skill_factor = score > 0 ? 0.52 : 0.48      (slight edge for proven agents)
price_change = direction × random × volatility
pnl = price_change × quantity / entry_price
```

The skill factor creates a subtle feedback loop:
- Previously successful agents get a 52% favorable outcome probability
- Unsuccessful agents get 48%
- This small edge (4% difference) compounds over many trades
- But randomness still dominates individual trades — just like real markets

Token prices use base values with random variance. Base prices are approximate starting points for simulation purposes.

---

## Data Architecture

### Entity Relationships

```
agents (1) ──→ (N) trades          Agent executes many trades
agents (1) ──→ (N) mutations       Agent has mutation history from cloning
agents (1) ──→ (N) agents          Parent-child lineage (self-referencing)
evolution_cycles (1) ──→ (N) mutations   Mutations occur during cycles
```

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `agents` | Trading agent registry | name, strategy[], parameters, performance metrics, parentId, generation |
| `trades` | Simulated trade records | agentId, token, direction, entry/exit price, pnl |
| `evolution_cycles` | Cycle history | cycleNumber, agents killed/spawned, avg score |
| `mutations` | Parameter change log | agentId, cycleId, parameter, oldValue, newValue |
| `activity_log` | System event feed | type (birth/death/clone/cycle/system), message |

### Security

Agent wallet private keys are stored server-side only. All API responses pass through a `sanitizeAgent()` function that strips `walletPrivateKey` before sending to the frontend. The lineage endpoint returns only safe fields (id, name, score, strategy, status).

---

## API Architecture

### OpenClaw Agent Endpoints

> Note: API routes use the `/api/clawra/` prefix as the internal subsystem identifier.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clawra/dashboard` | GET | Aggregated stats (agents, capital, P&L, cycles, best agent) |
| `/api/clawra/agents` | GET | All agents (sanitized, sorted by score) |
| `/api/clawra/agents/:id` | GET | Agent detail with trades, mutations, offspring |
| `/api/clawra/agents/spawn` | POST | Create new random agent |
| `/api/clawra/evolve` | POST | Execute one evolution cycle |
| `/api/clawra/trades` | GET | Recent trades (filterable by agentId, limit) |
| `/api/clawra/cycles` | GET | Evolution cycle history |
| `/api/clawra/mutations` | GET | Mutation records (filterable by agentId, cycleId) |
| `/api/clawra/activity` | GET | System activity feed |
| `/api/clawra/lineage` | GET | Lineage tree data (safe fields only) |

### Wallet Tool Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-wallet` | POST | Generate Solana Ed25519 keypair |
| `/api/balance` | POST | Check SOL balance (mainnet/devnet) |
| `/api/distribute` | POST | Distribute SOL across N wallets with batched transactions |
| `/api/withdraw` | POST | Sweep SOL from multiple wallets to destination |

---

## Frontend Architecture

### Page Structure

| Page | Path | Purpose |
|------|------|---------|
| Wallet Tools | `/` | Solana wallet generation, balance, distribution, withdrawal |
| Dashboard | `/clawra` | Real-time control center with stats, trades, activity feed |
| Agents | `/clawra/agents` | Agent registry with detail modals (parameters, trades, mutations) |
| Evolution | `/clawra/evolution` | Lineage tree by generation, mutation history log |
| Analytics | `/clawra/analytics` | Leaderboard, strategy comparison, token P&L, risk distribution |

### State Management

- TanStack React Query for server state with automatic cache invalidation
- Evolve/spawn mutations invalidate all related query keys for immediate UI refresh
- Dashboard uses 5-second polling interval for live updates
- Agent list uses 10-second polling interval

### Computed Analytics (Frontend)

The analytics page computes several derived metrics client-side:

- **Strategy Performance**: Groups agents by strategy, computes avg score/P&L/win rate per strategy
- **Token Performance**: Aggregates trade P&L by token across all agents
- **Risk Distribution**: Categorizes agents into low/medium/high risk buckets
- **Generation Stats**: Computes avg score and survival rate per generation

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Vite | SPA with hot module replacement |
| UI Components | shadcn/ui + Tailwind CSS | Pre-built accessible component primitives |
| State | TanStack React Query v5 | Server state management with caching |
| Routing | Wouter | Lightweight client-side routing |
| Backend | Express.js | REST API server |
| ORM | Drizzle | Type-safe PostgreSQL query builder |
| Database | PostgreSQL | Persistent storage for all entities |
| Blockchain | @solana/web3.js | Solana wallet generation and transactions |
| Validation | Zod + drizzle-zod | Runtime type validation for API inputs |
