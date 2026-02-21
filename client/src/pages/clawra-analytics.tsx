import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart3, TrendingUp, TrendingDown, PieChart, Target,
  Activity, Layers, Zap,
} from "lucide-react";
import type { Agent, Trade, EvolutionCycle } from "@shared/schema";

export default function ClawraAnalytics() {
  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/clawra/agents"],
  });

  const { data: trades, isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/clawra/trades", "?limit=200"],
  });

  const { data: cycles } = useQuery<EvolutionCycle[]>({
    queryKey: ["/api/clawra/cycles"],
  });

  const activeAgents = agents?.filter(a => a.status === "active") || [];

  const strategyPerformance = computeStrategyPerformance(activeAgents);
  const tokenPerformance = computeTokenPerformance(trades || []);
  const leaderboard = [...(activeAgents)].sort((a, b) => b.performanceScore - a.performanceScore);
  const riskDistribution = computeRiskDistribution(activeAgents);
  const generationStats = computeGenerationStats(agents || []);

  return (
    <div className="space-y-6" data-testid="clawra-analytics">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-analytics-title">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Deep performance analysis across agents, strategies, and tokens
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-leaderboard">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Agent Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <ScrollArea className="h-[360px]">
                <div className="space-y-1">
                  {leaderboard.map((agent, i) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`row-leaderboard-${agent.id}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-yellow-500/20 text-yellow-500" :
                        i === 1 ? "bg-gray-400/20 text-gray-400" :
                        i === 2 ? "bg-amber-600/20 text-amber-600" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {agent.strategy.slice(0, 2).map(s => (
                            <span key={s} className="text-[10px] text-muted-foreground">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium">{agent.performanceScore.toFixed(3)}</p>
                        <p className={`text-xs font-mono ${agent.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {agent.totalPnl >= 0 ? "+" : ""}{agent.totalPnl.toFixed(3)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-strategy-performance">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Strategy Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px]">
              <div className="space-y-3">
                {strategyPerformance.map(({ strategy, count, avgScore, avgPnl, avgWinRate }) => (
                  <div key={strategy} className="space-y-2 p-3 rounded-lg bg-muted/30" data-testid={`strategy-${strategy}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{strategy}</Badge>
                        <span className="text-xs text-muted-foreground">{count} agent{count !== 1 ? "s" : ""}</span>
                      </div>
                      <span className="font-mono text-sm font-medium">{avgScore.toFixed(3)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Avg Score</p>
                        <p className="font-mono text-xs">{avgScore.toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Avg P&L</p>
                        <p className={`font-mono text-xs ${avgPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {avgPnl >= 0 ? "+" : ""}{avgPnl.toFixed(3)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Win Rate</p>
                        <p className="font-mono text-xs">{(avgWinRate * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${avgPnl >= 0 ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(Math.abs(avgScore) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-token-performance">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Token Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tradesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {tokenPerformance.map(({ token, trades: tCount, totalPnl, winRate }) => (
                    <div
                      key={token}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      data-testid={`token-${token}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{token.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{token}</p>
                          <p className="text-xs text-muted-foreground">{tCount} trades</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-sm font-medium ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground">{(winRate * 100).toFixed(0)}% win</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-risk-distribution">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {riskDistribution.map(({ label, count, percentage }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-muted-foreground">{count} agents ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {generationStats.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Generation Performance
                </h4>
                <div className="space-y-2">
                  {generationStats.map(({ generation, count, avgScore, alive, dead }) => (
                    <div key={generation} className="flex items-center gap-3 text-sm">
                      <Badge variant="outline" className="text-xs font-mono w-16 justify-center">
                        Gen {generation}
                      </Badge>
                      <div className="flex-1">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(Math.max((avgScore + 1) * 50, 5), 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-mono text-xs w-12 text-right">{avgScore.toFixed(3)}</span>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {alive}A / {dead}D
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function computeStrategyPerformance(agents: Agent[]) {
  const map: Record<string, { scores: number[]; pnls: number[]; winRates: number[] }> = {};
  for (const agent of agents) {
    for (const strat of agent.strategy) {
      if (!map[strat]) map[strat] = { scores: [], pnls: [], winRates: [] };
      map[strat].scores.push(agent.performanceScore);
      map[strat].pnls.push(agent.totalPnl);
      map[strat].winRates.push(agent.winRate);
    }
  }
  return Object.entries(map)
    .map(([strategy, { scores, pnls, winRates }]) => ({
      strategy,
      count: scores.length,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      avgPnl: pnls.reduce((a, b) => a + b, 0) / pnls.length,
      avgWinRate: winRates.reduce((a, b) => a + b, 0) / winRates.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

function computeTokenPerformance(allTrades: Trade[]) {
  const map: Record<string, { pnls: number[]; wins: number }> = {};
  for (const trade of allTrades) {
    if (!map[trade.token]) map[trade.token] = { pnls: [], wins: 0 };
    map[trade.token].pnls.push(trade.pnl || 0);
    if ((trade.pnl || 0) > 0) map[trade.token].wins++;
  }
  return Object.entries(map)
    .map(([token, { pnls, wins }]) => ({
      token,
      trades: pnls.length,
      totalPnl: pnls.reduce((a, b) => a + b, 0),
      winRate: pnls.length > 0 ? wins / pnls.length : 0,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

function computeRiskDistribution(agents: Agent[]) {
  const total = agents.length || 1;
  const low = agents.filter(a => a.riskProfile < 0.3).length;
  const med = agents.filter(a => a.riskProfile >= 0.3 && a.riskProfile < 0.6).length;
  const high = agents.filter(a => a.riskProfile >= 0.6).length;
  return [
    { label: "Low Risk (< 30%)", count: low, percentage: (low / total) * 100 },
    { label: "Medium Risk (30-60%)", count: med, percentage: (med / total) * 100 },
    { label: "High Risk (> 60%)", count: high, percentage: (high / total) * 100 },
  ];
}

function computeGenerationStats(agents: Agent[]) {
  const map: Record<number, Agent[]> = {};
  for (const agent of agents) {
    if (!map[agent.generation]) map[agent.generation] = [];
    map[agent.generation].push(agent);
  }
  return Object.entries(map)
    .map(([gen, genAgents]) => ({
      generation: parseInt(gen),
      count: genAgents.length,
      avgScore: genAgents.reduce((s, a) => s + a.performanceScore, 0) / genAgents.length,
      alive: genAgents.filter(a => a.status === "active").length,
      dead: genAgents.filter(a => a.status === "dead").length,
    }))
    .sort((a, b) => a.generation - b.generation);
}
