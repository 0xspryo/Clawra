/**
 * CLAWRA Database Storage Layer
 * 
 * Implements the IStorage interface for PostgreSQL persistence of all
 * CLAWRA system entities: agents, trades, evolution cycles, mutations,
 * and activity logs.
 * 
 * Uses Drizzle ORM for type-safe query building with the node-postgres driver.
 * All queries are parameterized to prevent SQL injection.
 * 
 * Design decisions:
 * - Soft deletes for agents (status = "dead") to preserve lineage history
 * - Dashboard stats computed from live queries (no materialized views)
 *   since the dataset is small enough for real-time aggregation
 * - Mutations support compound filtering by agentId AND/OR cycleId
 *   for flexible lineage exploration
 * 
 * @module storage
 * @author CLAWRA
 */

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

/**
 * Storage interface defining all CRUD operations required by the
 * CLAWRA simulation engine and API routes.
 * 
 * This abstraction allows the storage implementation to be swapped
 * (e.g., for testing with in-memory storage) without modifying
 * business logic.
 */
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

/**
 * PostgreSQL implementation of the IStorage interface.
 * 
 * Uses Drizzle ORM for type-safe query construction.
 * Agents are always returned sorted by performance score (descending)
 * to support leaderboard and "best agent" queries without additional sorting.
 */
export class DatabaseStorage implements IStorage {
  /** Get all agents ordered by performance score (highest first) */
  async getAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(desc(agents.performanceScore));
  }

  /** Get only active (alive) agents, ordered by performance score */
  async getActiveAgents(): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.status, "active")).orderBy(desc(agents.performanceScore));
  }

  /** Get a single agent by ID */
  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  /** Create a new agent record */
  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  /**
   * Update agent fields. Automatically sets updatedAt timestamp.
   * Used by the evaluation engine to update performance metrics after each cycle.
   */
  async updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [updated] = await db.update(agents).set({ ...data, updatedAt: new Date() }).where(eq(agents.id, id)).returning();
    return updated;
  }

  /**
   * Soft-delete an agent by setting status to "dead".
   * This preserves the agent record for lineage tree visualization
   * and historical analysis rather than permanently removing it.
   */
  async deleteAgent(id: number): Promise<void> {
    await db.update(agents).set({ status: "dead", updatedAt: new Date() }).where(eq(agents.id, id));
  }

  /** Get all direct offspring of a parent agent (one level deep) */
  async getAgentDescendants(parentId: number): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.parentId, parentId));
  }

  /** Get trades, optionally filtered by agent ID */
  async getTrades(agentId?: number): Promise<Trade[]> {
    if (agentId) {
      return db.select().from(trades).where(eq(trades.agentId, agentId)).orderBy(desc(trades.timestamp));
    }
    return db.select().from(trades).orderBy(desc(trades.timestamp));
  }

  /** Get the N most recent trades across all agents */
  async getRecentTrades(limit: number): Promise<Trade[]> {
    return db.select().from(trades).orderBy(desc(trades.timestamp)).limit(limit);
  }

  /** Record a new trade */
  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [created] = await db.insert(trades).values(trade).returning();
    return created;
  }

  /** Update trade fields (e.g., closing an open trade) */
  async updateTrade(id: number, data: Partial<InsertTrade>): Promise<Trade | undefined> {
    const [updated] = await db.update(trades).set(data).where(eq(trades.id, id)).returning();
    return updated;
  }

  /** Get all evolution cycles, most recent first */
  async getCycles(): Promise<EvolutionCycle[]> {
    return db.select().from(evolutionCycles).orderBy(desc(evolutionCycles.cycleNumber));
  }

  /** Get the most recent evolution cycle */
  async getLatestCycle(): Promise<EvolutionCycle | undefined> {
    const [cycle] = await db.select().from(evolutionCycles).orderBy(desc(evolutionCycles.cycleNumber)).limit(1);
    return cycle;
  }

  /** Record a new evolution cycle */
  async createCycle(cycle: InsertEvolutionCycle): Promise<EvolutionCycle> {
    const [created] = await db.insert(evolutionCycles).values(cycle).returning();
    return created;
  }

  /**
   * Get mutations with optional compound filtering.
   * Supports filtering by agentId, cycleId, or both simultaneously.
   * This powers the lineage view where users can explore how a specific
   * agent's parameters evolved across cycles.
   */
  async getMutations(agentId?: number, cycleId?: number): Promise<Mutation[]> {
    const conditions = [];
    if (agentId) conditions.push(eq(mutations.agentId, agentId));
    if (cycleId) conditions.push(eq(mutations.cycleId, cycleId));
    if (conditions.length > 0) {
      return db.select().from(mutations).where(and(...conditions)).orderBy(desc(mutations.timestamp));
    }
    return db.select().from(mutations).orderBy(desc(mutations.timestamp));
  }

  /** Record a parameter mutation during cloning */
  async createMutation(mutation: InsertMutation): Promise<Mutation> {
    const [created] = await db.insert(mutations).values(mutation).returning();
    return created;
  }

  /** Get recent activity log entries */
  async getActivityLog(limit: number): Promise<ActivityLogEntry[]> {
    return db.select().from(activityLog).orderBy(desc(activityLog.timestamp)).limit(limit);
  }

  /** Record a new activity log entry */
  async createActivityLog(entry: InsertActivityLogEntry): Promise<ActivityLogEntry> {
    const [created] = await db.insert(activityLog).values(entry).returning();
    return created;
  }

  /**
   * Compute real-time dashboard statistics by aggregating across
   * all agents, trades, and cycles.
   * 
   * Returns the top-performing active agent for the "Best Agent" card,
   * leveraging the pre-sorted getAgents() query (first active = best).
   */
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
