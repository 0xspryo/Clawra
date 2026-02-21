/**
 * CLAWRA Simulation Engine
 * 
 * Core engine for the Closed-Loop Autonomous Wallet & Redistribution Architecture.
 * Implements a genetic algorithm-based evolution system for autonomous trading agents
 * on the Solana blockchain.
 * 
 * The simulation loop follows a biological evolution model:
 * 1. SPAWN - Create agents with randomized trading parameters and Solana wallets
 * 2. SIMULATE - Each agent executes trades based on its strategy configuration
 * 3. EVALUATE - Multi-factor fitness scoring (P&L, win rate, drawdown, capital efficiency)
 * 4. EVOLVE - Natural selection: kill bottom 30%, clone top 20% with mutations, inject randomness
 * 
 * Mutation model uses bounded uniform random perturbation on continuous parameters
 * (risk profile, position size, trade frequency, signal threshold) with a 20%
 * chance of strategy crossover during cloning.
 * 
 * @module simulation
 * @author CLAWRA
 */

import { storage } from "./storage";
import { STRATEGIES, TOKENS, type Agent, type InsertAgent } from "@shared/schema";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Agent naming system uses a combinatorial prefix-suffix-number format
 * to generate unique, memorable identifiers for each agent.
 * Prefix drawn from Greek alphabet + cyberpunk terms.
 * Suffix drawn from predator/action archetypes.
 */
const AGENT_NAMES_PREFIX = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
  "Apex", "Nova", "Pulse", "Drift", "Flux", "Vex", "Nyx", "Zen",
];

const AGENT_NAMES_SUFFIX = [
  "Hunter", "Stalker", "Runner", "Seeker", "Watcher", "Crawler", "Striker", "Phantom",
  "Ghost", "Shadow", "Blade", "Fang", "Claw", "Spike", "Storm", "Surge",
  "Volt", "Blaze", "Frost", "Viper", "Hawk", "Wolf", "Raven", "Mantis",
];

/**
 * Generate a unique agent name from the combinatorial name pool.
 * Format: {Prefix}-{Suffix}-{000-999}
 * Total namespace: 32 * 24 * 1000 = 768,000 unique combinations
 */
function randomName(): string {
  const prefix = AGENT_NAMES_PREFIX[Math.floor(Math.random() * AGENT_NAMES_PREFIX.length)];
  const suffix = AGENT_NAMES_SUFFIX[Math.floor(Math.random() * AGENT_NAMES_SUFFIX.length)];
  const num = Math.floor(Math.random() * 999);
  return `${prefix}-${suffix}-${num}`;
}

/**
 * Select 1-3 random strategies from the available strategy pool.
 * Multi-strategy agents can combine signals from different approaches
 * (e.g., momentum + sentiment for trend-following with social confirmation).
 */
function randomStrategies(): string[] {
  const count = 1 + Math.floor(Math.random() * 3);
  const shuffled = [...STRATEGIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Clamp a value to [min, max] range to keep parameters within valid bounds */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Apply bounded uniform random mutation to a parameter value.
 * Uses uniform random perturbation within [-range, +range] centered on current value.
 * This is the core genetic operator that allows offspring to differ from parents.
 * 
 * @param val - Current parameter value
 * @param range - Maximum absolute deviation (mutation intensity)
 */
function mutateValue(val: number, range: number): number {
  return val + (Math.random() - 0.5) * 2 * range;
}

/**
 * Spawn a new trading agent with a fresh Solana wallet.
 * 
 * Each agent receives:
 * - A unique Ed25519 Solana keypair (wallet)
 * - 1-3 randomly selected trading strategies
 * - Randomized parameters within biologically-inspired ranges:
 *   - Risk profile: 0.1-0.9 (conservative to aggressive)
 *   - Position size: 0.01-0.5 (fraction of capital per trade)
 *   - Trade frequency: 0.1-1.0 (trades per simulation tick)
 *   - Signal threshold: 0.2-0.9 (confidence required to enter trade)
 * - Starting capital: 5-25 SOL (randomized to test capital efficiency)
 * 
 * @param parentId - If cloned, the ID of the parent agent
 * @param generation - Generation number (1 for origin agents)
 */
export async function spawnAgent(parentId?: number, generation?: number): Promise<Agent> {
  const keypair = Keypair.generate();
  const startingCapital = 5 + Math.random() * 20;

  const agent: InsertAgent = {
    name: randomName(),
    walletAddress: keypair.publicKey.toBase58(),
    walletPrivateKey: bs58.encode(keypair.secretKey),
    strategy: randomStrategies(),
    riskProfile: clamp(0.2 + Math.random() * 0.6, 0.1, 0.9),
    positionSize: clamp(0.05 + Math.random() * 0.3, 0.01, 0.5),
    tradeFrequency: clamp(0.2 + Math.random() * 0.6, 0.1, 1.0),
    signalThreshold: clamp(0.3 + Math.random() * 0.5, 0.2, 0.9),
    assetPreference: TOKENS[Math.floor(Math.random() * TOKENS.length)],
    mutationSeed: Math.floor(Math.random() * 1000000),
    performanceScore: 0,
    totalPnl: 0,
    winRate: 0,
    totalTrades: 0,
    capitalAllocated: startingCapital,
    age: 0,
    generation: generation || 1,
    parentId: parentId || null,
    status: "active",
  };

  const created = await storage.createAgent(agent);
  await storage.createActivityLog({
    type: "birth",
    message: `Agent ${created.name} spawned (Gen ${created.generation})${parentId ? ` from parent #${parentId}` : " — origin"}`,
    agentId: created.id,
  });
  return created;
}

/**
 * Clone a high-performing agent with genetic mutations.
 * 
 * Cloning implements the "reproduction with variation" step of the genetic algorithm:
 * 
 * 1. PARAMETER MUTATION: Each continuous parameter (risk, position size, frequency,
 *    threshold) is perturbed by ±15% (base mutation rate). Position size uses half
 *    the mutation rate to preserve capital management stability.
 * 
 * 2. STRATEGY CROSSOVER: 20% chance of acquiring a new strategy from the global
 *    pool, replacing the least-used one if at capacity (max 3 strategies).
 *    This allows beneficial strategy combinations to emerge over generations.
 * 
 * 3. CAPITAL INHERITANCE: Offspring receive 50% of parent's capital allocation,
 *    simulating resource splitting during reproduction.
 * 
 * 4. ASSET PREFERENCE: 80% chance of inheriting parent's token preference,
 *    20% chance of exploring a new token market.
 * 
 * All mutations are recorded in the mutations table for lineage analysis.
 * 
 * @param parent - The parent agent being cloned
 * @param cycleId - The evolution cycle during which cloning occurs
 */
export async function cloneAgent(parent: Agent, cycleId: number): Promise<Agent> {
  const keypair = Keypair.generate();
  const mutationRate = 0.15;

  const newRisk = clamp(mutateValue(parent.riskProfile, mutationRate), 0.1, 0.9);
  const newPosSize = clamp(mutateValue(parent.positionSize, mutationRate * 0.5), 0.01, 0.5);
  const newFreq = clamp(mutateValue(parent.tradeFrequency, mutationRate), 0.1, 1.0);
  const newThreshold = clamp(mutateValue(parent.signalThreshold, mutationRate), 0.2, 0.9);

  const strategies = [...parent.strategy];
  if (Math.random() < 0.2) {
    const newStrat = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
    if (!strategies.includes(newStrat)) {
      if (strategies.length >= 3) strategies.pop();
      strategies.push(newStrat);
    }
  }

  const child: InsertAgent = {
    name: randomName(),
    walletAddress: keypair.publicKey.toBase58(),
    walletPrivateKey: bs58.encode(keypair.secretKey),
    strategy: strategies,
    riskProfile: newRisk,
    positionSize: newPosSize,
    tradeFrequency: newFreq,
    signalThreshold: newThreshold,
    assetPreference: Math.random() < 0.8 ? parent.assetPreference : TOKENS[Math.floor(Math.random() * TOKENS.length)],
    mutationSeed: Math.floor(Math.random() * 1000000),
    performanceScore: 0,
    totalPnl: 0,
    winRate: 0,
    totalTrades: 0,
    capitalAllocated: parent.capitalAllocated * 0.5,
    age: 0,
    generation: parent.generation + 1,
    parentId: parent.id,
    status: "active",
  };

  const created = await storage.createAgent(child);

  const mutationParams = [
    { param: "risk_profile", old: parent.riskProfile, new: newRisk },
    { param: "position_size", old: parent.positionSize, new: newPosSize },
    { param: "trade_frequency", old: parent.tradeFrequency, new: newFreq },
    { param: "signal_threshold", old: parent.signalThreshold, new: newThreshold },
  ];

  for (const m of mutationParams) {
    await storage.createMutation({
      agentId: created.id,
      cycleId,
      parameter: m.param,
      oldValue: m.old,
      newValue: m.new,
    });
  }

  await storage.createActivityLog({
    type: "clone",
    message: `Agent ${created.name} cloned from ${parent.name} (Gen ${parent.generation} → ${created.generation})`,
    agentId: created.id,
    cycleId,
  });

  return created;
}

/**
 * Simulate trading activity for an agent based on its parameters.
 * 
 * Trade simulation model:
 * - Trade count scales with tradeFrequency parameter (1-5 trades per tick)
 * - 60% of trades use the agent's preferred asset, 40% explore other tokens
 * - Direction (long/short) is randomly selected
 * - Volatility is a function of riskProfile: higher risk = wider price swings
 *   volatility = 0.02 + riskProfile * 0.08 (range: 2-10% per trade)
 * - Skill factor introduces a slight edge for previously-successful agents:
 *   positive score agents have 52% favorable outcome probability
 *   negative/zero score agents have 48% (slight disadvantage)
 * - P&L calculated as directional price change * position quantity
 * 
 * This creates a realistic feedback loop where good parameters are slightly
 * more likely to produce wins, but randomness still dominates — just like
 * real markets. Over many trades and evolution cycles, the genetic algorithm
 * gradually converges on parameter combinations that survive.
 * 
 * @param agent - The agent executing trades
 */
export async function simulateTrades(agent: Agent): Promise<void> {
  const tradeCount = Math.max(1, Math.floor(agent.tradeFrequency * 5));

  for (let i = 0; i < tradeCount; i++) {
    const token = Math.random() < 0.6 ? agent.assetPreference : TOKENS[Math.floor(Math.random() * TOKENS.length)];
    const direction = Math.random() > 0.5 ? "long" : "short";
    const entryPrice = getSimulatedPrice(token);
    const quantity = agent.capitalAllocated * agent.positionSize;

    const volatility = 0.02 + agent.riskProfile * 0.08;
    const skillFactor = agent.performanceScore > 0 ? 0.52 : 0.48;
    const priceChange = (Math.random() < skillFactor ? 1 : -1) * Math.random() * volatility;
    const exitPrice = entryPrice * (1 + (direction === "long" ? priceChange : -priceChange));
    const pnl = (exitPrice - entryPrice) * quantity * (direction === "long" ? 1 : -1) / entryPrice;

    const tradeTime = new Date(Date.now() - Math.random() * 3600000);
    await storage.createTrade({
      agentId: agent.id,
      token,
      direction,
      entryPrice,
      exitPrice,
      quantity,
      pnl,
      status: "closed",
      closedAt: new Date(),
    });
  }
}

/**
 * Generate simulated market prices for Solana ecosystem tokens.
 * Prices are modeled as base price + random variance to simulate
 * realistic market conditions. Base prices approximate real-world
 * token valuations as of the development period.
 * 
 * @param token - Token symbol (SOL, BONK, WIF, etc.)
 * @returns Simulated current price with random variance
 */
function getSimulatedPrice(token: string): number {
  const prices: Record<string, number> = {
    SOL: 120 + Math.random() * 40,
    BONK: 0.000015 + Math.random() * 0.00001,
    WIF: 1.5 + Math.random() * 1,
    JUP: 0.8 + Math.random() * 0.4,
    PYTH: 0.3 + Math.random() * 0.2,
    RAY: 2 + Math.random() * 1.5,
    ORCA: 0.6 + Math.random() * 0.3,
    MNGO: 0.02 + Math.random() * 0.01,
    STEP: 0.03 + Math.random() * 0.02,
    SRM: 0.04 + Math.random() * 0.02,
  };
  return prices[token] || 1;
}

/**
 * Evaluate an agent's fitness using a multi-factor composite scoring model.
 * 
 * The fitness function is designed to reward consistent, sustainable performance
 * over raw returns. It uses four weighted components:
 * 
 * SCORING FORMULA:
 *   score = 0.35 * normalized_pnl     → Rewards absolute profitability
 *         + 0.25 * win_rate            → Rewards consistency (wins/total)
 *         + 0.20 * drawdown_inverse    → Penalizes large single-trade losses
 *         + 0.20 * capital_efficiency  → Rewards returns relative to capital deployed
 * 
 * - normalized_pnl: P&L clamped to [-1, 1] range (normalized by dividing by 10)
 * - win_rate: Simple ratio of profitable trades to total trades
 * - drawdown_inverse: 1/(1 + max_loss), penalizes agents with catastrophic losses
 * - capital_efficiency: total_pnl / capital_allocated, measures ROI
 * 
 * After evaluation, agent's capital is adjusted: +10% of P&L added to capital
 * (minimum floor of 0.1 SOL to prevent total wipeout).
 * Agent's age is incremented by 1 cycle.
 * 
 * @param agent - The agent to evaluate
 * @returns Updated agent with new performance metrics
 */
export async function evaluateAgent(agent: Agent): Promise<Agent> {
  const agentTrades = await storage.getTrades(agent.id);
  const closedTrades = agentTrades.filter(t => t.status === "closed" && t.pnl !== null);

  if (closedTrades.length === 0) return agent;

  const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
  const winRate = wins / closedTrades.length;
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const avgPnl = totalPnl / closedTrades.length;

  const maxDrawdown = Math.abs(Math.min(0, ...closedTrades.map(t => t.pnl || 0)));
  const drawdownInverse = maxDrawdown > 0 ? 1 / (1 + maxDrawdown) : 1;
  const capitalEfficiency = agent.capitalAllocated > 0 ? totalPnl / agent.capitalAllocated : 0;

  const score =
    0.35 * (totalPnl > 0 ? Math.min(totalPnl / 10, 1) : Math.max(totalPnl / 10, -1)) +
    0.25 * winRate +
    0.20 * drawdownInverse +
    0.20 * Math.min(Math.max(capitalEfficiency, -1), 1);

  const newCapital = Math.max(0.1, agent.capitalAllocated + totalPnl * 0.1);

  const updated = await storage.updateAgent(agent.id, {
    performanceScore: score,
    totalPnl: agent.totalPnl + totalPnl,
    winRate,
    totalTrades: agent.totalTrades + closedTrades.length,
    capitalAllocated: newCapital,
    age: agent.age + 1,
  });

  return updated || agent;
}

/**
 * Execute a complete evolution cycle.
 * 
 * This is the main loop of the CLAWRA genetic algorithm. Each cycle:
 * 
 * 1. TRADE PHASE: All active agents execute simulated trades
 * 2. EVALUATION PHASE: Each agent's fitness score is recalculated
 * 3. RANKING: Agents sorted by performance score (descending)
 * 4. SELECTION PRESSURE:
 *    - Bottom 30% are eliminated ("death" — status set to "dead")
 *    - Top 20% are cloned with parameter mutations ("reproduction")
 *    - 1 completely random agent is injected ("immigration")
 * 
 * The 30/20/1 ratio creates steady-state population dynamics:
 * - Population slowly grows as clones + new > kills
 * - Diversity is maintained via random injection
 * - Selection pressure is strong enough to drive convergence
 *   but not so strong that the population collapses
 * 
 * All events are logged to the activity feed and evolution cycle
 * history for analysis and visualization.
 */
export async function runEvolutionCycle(): Promise<void> {
  const activeAgents = await storage.getActiveAgents();
  if (activeAgents.length < 2) return;

  for (const agent of activeAgents) {
    await simulateTrades(agent);
  }

  const evaluated: Agent[] = [];
  for (const agent of activeAgents) {
    evaluated.push(await evaluateAgent(agent));
  }

  evaluated.sort((a, b) => b.performanceScore - a.performanceScore);

  const latestCycle = await storage.getLatestCycle();
  const cycleNumber = latestCycle ? latestCycle.cycleNumber + 1 : 1;

  const killCount = Math.max(1, Math.floor(evaluated.length * 0.3));
  const cloneCount = Math.max(1, Math.floor(evaluated.length * 0.2));
  const toKill = evaluated.slice(-killCount);
  const toClone = evaluated.slice(0, cloneCount);

  const cycle = await storage.createCycle({
    cycleNumber,
    agentsAlive: evaluated.length - killCount + cloneCount + 1,
    agentsKilled: killCount,
    agentsSpawned: cloneCount + 1,
    agentsMutated: cloneCount,
    totalCapital: evaluated.reduce((sum, a) => sum + a.capitalAllocated, 0),
    bestAgentId: evaluated[0]?.id || null,
    worstAgentId: evaluated[evaluated.length - 1]?.id || null,
    avgScore: evaluated.reduce((sum, a) => sum + a.performanceScore, 0) / evaluated.length,
  });

  for (const agent of toKill) {
    await storage.deleteAgent(agent.id);
    await storage.createActivityLog({
      type: "death",
      message: `Agent ${agent.name} eliminated (score: ${agent.performanceScore.toFixed(3)}, age: ${agent.age})`,
      agentId: agent.id,
      cycleId: cycle.id,
    });
  }

  for (const agent of toClone) {
    await cloneAgent(agent, cycle.id);
  }

  await spawnAgent(undefined, 1);

  await storage.createActivityLog({
    type: "cycle",
    message: `Evolution cycle #${cycleNumber}: ${killCount} killed, ${cloneCount + 1} spawned, avg score ${cycle.avgScore.toFixed(3)}`,
    cycleId: cycle.id,
  });
}

/**
 * Initialize the CLAWRA system with a starting population.
 * 
 * Seeds the database with `count` origin agents (Generation 1) and runs
 * 8 evolution cycles to create an initial lineage tree with multiple
 * generations, mutations, and trade history.
 * 
 * This is idempotent — if agents already exist in the database,
 * seeding is skipped to prevent duplicate initialization.
 * 
 * @param count - Number of origin agents to spawn (default: 12)
 */
export async function seedInitialAgents(count: number = 12): Promise<void> {
  const existing = await storage.getAgents();
  if (existing.length > 0) return;

  const agents: Agent[] = [];
  for (let i = 0; i < count; i++) {
    agents.push(await spawnAgent());
  }

  for (let cycle = 0; cycle < 8; cycle++) {
    await runEvolutionCycle();
  }

  await storage.createActivityLog({
    type: "system",
    message: "CLAWRA system initialized. Autonomous evolution active.",
  });
}
