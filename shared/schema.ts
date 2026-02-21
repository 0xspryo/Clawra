import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, jsonb, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  walletAddress: text("wallet_address").notNull(),
  walletPrivateKey: text("wallet_private_key").notNull(),
  strategy: text("strategy").array().notNull(),
  riskProfile: real("risk_profile").notNull().default(0.5),
  positionSize: real("position_size").notNull().default(0.1),
  tradeFrequency: real("trade_frequency").notNull().default(0.5),
  signalThreshold: real("signal_threshold").notNull().default(0.6),
  assetPreference: text("asset_preference").notNull().default("SOL"),
  mutationSeed: integer("mutation_seed").notNull(),
  performanceScore: real("performance_score").notNull().default(0),
  totalPnl: real("total_pnl").notNull().default(0),
  winRate: real("win_rate").notNull().default(0),
  totalTrades: integer("total_trades").notNull().default(0),
  capitalAllocated: real("capital_allocated").notNull().default(0),
  age: integer("age").notNull().default(0),
  generation: integer("generation").notNull().default(1),
  parentId: integer("parent_id"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  token: text("token").notNull(),
  direction: text("direction").notNull(),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  quantity: real("quantity").notNull(),
  pnl: real("pnl"),
  status: text("status").notNull().default("open"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const evolutionCycles = pgTable("evolution_cycles", {
  id: serial("id").primaryKey(),
  cycleNumber: integer("cycle_number").notNull(),
  agentsAlive: integer("agents_alive").notNull(),
  agentsKilled: integer("agents_killed").notNull().default(0),
  agentsSpawned: integer("agents_spawned").notNull().default(0),
  agentsMutated: integer("agents_mutated").notNull().default(0),
  totalCapital: real("total_capital").notNull().default(0),
  bestAgentId: integer("best_agent_id"),
  worstAgentId: integer("worst_agent_id"),
  avgScore: real("avg_score").notNull().default(0),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const mutations = pgTable("mutations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  cycleId: integer("cycle_id").notNull(),
  parameter: text("parameter").notNull(),
  oldValue: real("old_value").notNull(),
  newValue: real("new_value").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  agentId: integer("agent_id"),
  cycleId: integer("cycle_id"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, timestamp: true });
export const insertEvolutionCycleSchema = createInsertSchema(evolutionCycles).omit({ id: true, timestamp: true });
export const insertMutationSchema = createInsertSchema(mutations).omit({ id: true, timestamp: true });
export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true, timestamp: true });

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type EvolutionCycle = typeof evolutionCycles.$inferSelect;
export type InsertEvolutionCycle = z.infer<typeof insertEvolutionCycleSchema>;
export type Mutation = typeof mutations.$inferSelect;
export type InsertMutation = z.infer<typeof insertMutationSchema>;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type InsertActivityLogEntry = z.infer<typeof insertActivityLogSchema>;

export const STRATEGIES = [
  "momentum",
  "mean_reversion",
  "sentiment",
  "sniper",
  "arbitrage",
  "liquidity_tracking",
  "meme_velocity",
] as const;

export const TOKENS = ["SOL", "BONK", "WIF", "JUP", "PYTH", "RAY", "ORCA", "MNGO", "STEP", "SRM"] as const;

export const checkBalanceSchema = z.object({
  privateKey: z.string().min(1, "Private key is required"),
});

export const distributeSchema = z.object({
  privateKey: z.string().min(1, "Private key is required"),
  walletCount: z.number().min(1).max(50),
});

export const withdrawSchema = z.object({
  walletPrivateKeys: z.array(z.string().min(1)).min(1),
  destinationAddress: z.string().min(1, "Destination address is required"),
});

export type CheckBalanceRequest = z.infer<typeof checkBalanceSchema>;
export type DistributeRequest = z.infer<typeof distributeSchema>;
export type WithdrawRequest = z.infer<typeof withdrawSchema>;

export interface WalletInfo {
  publicKey: string;
  privateKey: string;
  amount: number;
}

export interface BalanceResponse {
  balance: number;
  publicKey: string;
}

export interface DistributeResponse {
  wallets: WalletInfo[];
  totalDistributed: number;
  sourcePublicKey: string;
  signatures: string[];
}

export interface WithdrawResponse {
  totalWithdrawn: number;
  destinationAddress: string;
  signatures: string[];
  walletsSwept: number;
  walletsSkipped: number;
}
