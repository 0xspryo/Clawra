import { eq, desc, asc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  agents, trades, evolutionCycles, mutations, activityLog,
  type Agent, type InsertAgent,
  type Trade, type InsertTrade,
  type EvolutionCycle, type InsertEvolutionCycle,
  type Mutation, type InsertMutation,
  type ActivityLogEntry, type InsertActivityLogEntry,
} from "@shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  getAgents(): Promise<Agent[]>;
  getActiveAgents(): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<void>;
  getAgentDescendants(parentId: number): Promise<Agent[]>;

  getTrades(agentId?: number): Promise<Trade[]>;
  getRecentTrades(limit: number): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, data: Partial<InsertTrade>): Promise<Trade | undefined>;

  getCycles(): Promise<EvolutionCycle[]>;
  getLatestCycle(): Promise<EvolutionCycle | undefined>;
  createCycle(cycle: InsertEvolutionCycle): Promise<EvolutionCycle>;

  getMutations(agentId?: number, cycleId?: number): Promise<Mutation[]>;
  createMutation(mutation: InsertMutation): Promise<Mutation>;

  getActivityLog(limit: number): Promise<ActivityLogEntry[]>;
  createActivityLog(entry: InsertActivityLogEntry): Promise<ActivityLogEntry>;

  getDashboardStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalCapital: number;
    totalTrades: number;
    totalPnl: number;
    avgWinRate: number;
    totalCycles: number;
    bestAgent: Agent | null;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(desc(agents.performanceScore));
  }

  async getActiveAgents(): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.status, "active")).orderBy(desc(agents.performanceScore));
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [updated] = await db.update(agents).set({ ...data, updatedAt: new Date() }).where(eq(agents.id, id)).returning();
    return updated;
  }

  async deleteAgent(id: number): Promise<void> {
    await db.update(agents).set({ status: "dead", updatedAt: new Date() }).where(eq(agents.id, id));
  }

  async getAgentDescendants(parentId: number): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.parentId, parentId));
  }

  async getTrades(agentId?: number): Promise<Trade[]> {
    if (agentId) {
      return db.select().from(trades).where(eq(trades.agentId, agentId)).orderBy(desc(trades.timestamp));
    }
    return db.select().from(trades).orderBy(desc(trades.timestamp));
  }

  async getRecentTrades(limit: number): Promise<Trade[]> {
    return db.select().from(trades).orderBy(desc(trades.timestamp)).limit(limit);
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [created] = await db.insert(trades).values(trade).returning();
    return created;
  }

  async updateTrade(id: number, data: Partial<InsertTrade>): Promise<Trade | undefined> {
    const [updated] = await db.update(trades).set(data).where(eq(trades.id, id)).returning();
    return updated;
  }

  async getCycles(): Promise<EvolutionCycle[]> {
    return db.select().from(evolutionCycles).orderBy(desc(evolutionCycles.cycleNumber));
  }

  async getLatestCycle(): Promise<EvolutionCycle | undefined> {
    const [cycle] = await db.select().from(evolutionCycles).orderBy(desc(evolutionCycles.cycleNumber)).limit(1);
    return cycle;
  }

  async createCycle(cycle: InsertEvolutionCycle): Promise<EvolutionCycle> {
    const [created] = await db.insert(evolutionCycles).values(cycle).returning();
    return created;
  }

  async getMutations(agentId?: number, cycleId?: number): Promise<Mutation[]> {
    const conditions = [];
    if (agentId) conditions.push(eq(mutations.agentId, agentId));
    if (cycleId) conditions.push(eq(mutations.cycleId, cycleId));
    if (conditions.length > 0) {
      return db.select().from(mutations).where(and(...conditions)).orderBy(desc(mutations.timestamp));
    }
    return db.select().from(mutations).orderBy(desc(mutations.timestamp));
  }

  async createMutation(mutation: InsertMutation): Promise<Mutation> {
    const [created] = await db.insert(mutations).values(mutation).returning();
    return created;
  }

  async getActivityLog(limit: number): Promise<ActivityLogEntry[]> {
    return db.select().from(activityLog).orderBy(desc(activityLog.timestamp)).limit(limit);
  }

  async createActivityLog(entry: InsertActivityLogEntry): Promise<ActivityLogEntry> {
    const [created] = await db.insert(activityLog).values(entry).returning();
    return created;
  }

  async getDashboardStats() {
    const allAgents = await this.getAgents();
    const active = allAgents.filter(a => a.status === "active");
    const allTrades = await db.select().from(trades);
    const cycles = await this.getCycles();

    const totalPnl = allAgents.reduce((sum, a) => sum + a.totalPnl, 0);
    const totalCapital = active.reduce((sum, a) => sum + a.capitalAllocated, 0);
    const avgWinRate = active.length > 0 ? active.reduce((sum, a) => sum + a.winRate, 0) / active.length : 0;
    const bestAgent = active.length > 0 ? active[0] : null;

    return {
      totalAgents: allAgents.length,
      activeAgents: active.length,
      totalCapital,
      totalTrades: allTrades.length,
      totalPnl,
      avgWinRate,
      totalCycles: cycles.length,
      bestAgent,
    };
  }
}

export const storage = new DatabaseStorage();
