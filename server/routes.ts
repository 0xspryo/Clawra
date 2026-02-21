import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import { checkBalanceSchema, distributeSchema, withdrawSchema } from "@shared/schema";
import { storage } from "./storage";
import { spawnAgent, runEvolutionCycle, seedInitialAgents } from "./simulation";
import type { Agent } from "@shared/schema";

function sanitizeAgent(agent: Agent) {
  const { walletPrivateKey, ...safe } = agent;
  return safe;
}

const RPC_URLS: Record<string, string> = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
};

function getRpcUrl(network: string): string {
  return RPC_URLS[network] || RPC_URLS.mainnet;
}

function getKeypairFromPrivateKey(privateKeyStr: string): Keypair {
  try {
    const decoded = bs58.decode(privateKeyStr);
    return Keypair.fromSecretKey(decoded);
  } catch {
    throw new Error("Invalid private key format. Please provide a valid base58-encoded private key.");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await seedInitialAgents(12);

  app.get("/api/clawra/dashboard", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      const safeStats = {
        ...stats,
        bestAgent: stats.bestAgent ? sanitizeAgent(stats.bestAgent) : null,
      };
      res.json(safeStats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clawra/agents", async (_req, res) => {
    try {
      const allAgents = await storage.getAgents();
      res.json(allAgents.map(sanitizeAgent));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clawra/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(parseInt(req.params.id));
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const agentTrades = await storage.getTrades(agent.id);
      const agentMutations = await storage.getMutations(agent.id);
      const children = await storage.getAgentDescendants(agent.id);
      res.json({ agent: sanitizeAgent(agent), trades: agentTrades, mutations: agentMutations, children: children.map(sanitizeAgent) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clawra/agents/spawn", async (_req, res) => {
    try {
      const agent = await spawnAgent();
      res.json(sanitizeAgent(agent));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clawra/trades", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const agentId = req.query.agentId ? parseInt(req.query.agentId as string) : undefined;
      const result = agentId ? await storage.getTrades(agentId) : await storage.getRecentTrades(limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clawra/cycles", async (_req, res) => {
    try {
      const cycles = await storage.getCycles();
      res.json(cycles);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clawra/evolve", async (_req, res) => {
    try {
      await runEvolutionCycle();
      const stats = await storage.getDashboardStats();
      res.json({ message: "Evolution cycle complete", stats });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clawra/mutations", async (req, res) => {
    try {
      const agentId = req.query.agentId ? parseInt(req.query.agentId as string) : undefined;
      const cycleId = req.query.cycleId ? parseInt(req.query.cycleId as string) : undefined;
      const result = await storage.getMutations(agentId, cycleId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clawra/activity", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await storage.getActivityLog(limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/clawra/lineage", async (_req, res) => {
    try {
      const allAgents = await storage.getAgents();
      const nodes = allAgents.map(a => ({
        id: a.id,
        name: a.name,
        parentId: a.parentId,
        generation: a.generation,
        status: a.status,
        score: a.performanceScore,
        strategy: a.strategy,
        age: a.age,
        pnl: a.totalPnl,
      }));
      res.json(nodes);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/generate-wallet", async (_req, res) => {
    try {
      const keypair = Keypair.generate();
      res.json({
        publicKey: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to generate wallet" });
    }
  });

  app.post("/api/balance", async (req, res) => {
    try {
      const parsed = checkBalanceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const network = (req.body.network as string) || "mainnet";
      const keypair = getKeypairFromPrivateKey(parsed.data.privateKey);
      const connection = new Connection(getRpcUrl(network), "confirmed");
      const balanceLamports = await connection.getBalance(keypair.publicKey);
      res.json({ balance: balanceLamports / LAMPORTS_PER_SOL, publicKey: keypair.publicKey.toBase58() });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to check balance" });
    }
  });

  app.post("/api/distribute", async (req, res) => {
    try {
      const parsed = distributeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { privateKey, walletCount } = parsed.data;
      const network = (req.body.network as string) || "mainnet";
      const sourceKeypair = getKeypairFromPrivateKey(privateKey);
      const connection = new Connection(getRpcUrl(network), "confirmed");
      const balanceLamports = await connection.getBalance(sourceKeypair.publicKey);

      const newWallets: Array<{ keypair: Keypair; publicKey: string; privateKey: string; amount: number }> = [];
      for (let i = 0; i < walletCount; i++) {
        const newKeypair = Keypair.generate();
        newWallets.push({ keypair: newKeypair, publicKey: newKeypair.publicKey.toBase58(), privateKey: bs58.encode(newKeypair.secretKey), amount: 0 });
      }

      const batchSize = 5;
      const numBatches = Math.ceil(walletCount / batchSize);
      const totalFees = 5000 * numBatches;
      const rentExemptMin = 890880;
      const totalRent = rentExemptMin * walletCount;
      const distributableLamports = balanceLamports - totalFees - totalRent;

      if (distributableLamports <= 0) {
        return res.status(400).json({ message: `Insufficient balance.` });
      }

      const amountPerWallet = Math.floor(distributableLamports / walletCount) + rentExemptMin;
      for (const w of newWallets) { w.amount = amountPerWallet / LAMPORTS_PER_SOL; }

      const signatures: string[] = [];
      const completedWallets: typeof newWallets = [];

      for (let i = 0; i < newWallets.length; i += batchSize) {
        const batch = newWallets.slice(i, i + batchSize);
        const transaction = new Transaction();
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = sourceKeypair.publicKey;
        for (const wallet of batch) {
          transaction.add(SystemProgram.transfer({ fromPubkey: sourceKeypair.publicKey, toPubkey: wallet.keypair.publicKey, lamports: amountPerWallet }));
        }
        try {
          const sig = await sendAndConfirmTransaction(connection, transaction, [sourceKeypair]);
          signatures.push(sig);
          completedWallets.push(...batch);
        } catch (batchErr: any) {
          if (completedWallets.length > 0) {
            return res.json({ wallets: completedWallets.map(w => ({ publicKey: w.publicKey, privateKey: w.privateKey, amount: w.amount })), totalDistributed: (amountPerWallet * completedWallets.length) / LAMPORTS_PER_SOL, sourcePublicKey: sourceKeypair.publicKey.toBase58(), signatures });
          }
          throw batchErr;
        }
      }

      res.json({ wallets: completedWallets.map(w => ({ publicKey: w.publicKey, privateKey: w.privateKey, amount: w.amount })), totalDistributed: (amountPerWallet * completedWallets.length) / LAMPORTS_PER_SOL, sourcePublicKey: sourceKeypair.publicKey.toBase58(), signatures });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Distribution failed" });
    }
  });

  app.post("/api/withdraw", async (req, res) => {
    try {
      const parsed = withdrawSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { walletPrivateKeys, destinationAddress } = parsed.data;
      const network = (req.body.network as string) || "mainnet";
      const connection = new Connection(getRpcUrl(network), "confirmed");
      let destPubkey: PublicKey;
      try { destPubkey = new PublicKey(destinationAddress); } catch { return res.status(400).json({ message: "Invalid destination address" }); }

      const signatures: string[] = [];
      let totalWithdrawn = 0, walletsSwept = 0, walletsSkipped = 0;

      for (const privKey of walletPrivateKeys) {
        try {
          const keypair = getKeypairFromPrivateKey(privKey);
          const balanceLamports = await connection.getBalance(keypair.publicKey);
          if (balanceLamports <= 5000) { walletsSkipped++; continue; }
          const sendAmount = balanceLamports - 5000;
          const transaction = new Transaction();
          const { blockhash } = await connection.getLatestBlockhash("confirmed");
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = keypair.publicKey;
          transaction.add(SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: destPubkey, lamports: sendAmount }));
          const sig = await sendAndConfirmTransaction(connection, transaction, [keypair]);
          signatures.push(sig);
          totalWithdrawn += sendAmount / LAMPORTS_PER_SOL;
          walletsSwept++;
        } catch { walletsSkipped++; }
      }

      res.json({ totalWithdrawn, destinationAddress, signatures, walletsSwept, walletsSkipped });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Withdraw failed" });
    }
  });

  return httpServer;
}
