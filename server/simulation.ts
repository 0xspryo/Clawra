import { storage } from "./storage";
import { STRATEGIES, TOKENS, type Agent, type InsertAgent } from "@shared/schema";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

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

function randomName(): string {
  const prefix = AGENT_NAMES_PREFIX[Math.floor(Math.random() * AGENT_NAMES_PREFIX.length)];
  const suffix = AGENT_NAMES_SUFFIX[Math.floor(Math.random() * AGENT_NAMES_SUFFIX.length)];
  const num = Math.floor(Math.random() * 999);
  return `${prefix}-${suffix}-${num}`;
}

function randomStrategies(): string[] {
  const count = 1 + Math.floor(Math.random() * 3);
  const shuffled = [...STRATEGIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function mutateValue(val: number, range: number): number {
  return val + (Math.random() - 0.5) * 2 * range;
}

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
