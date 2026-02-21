import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot, TrendingUp, Skull, Zap, DollarSign, Target,
  Activity, BarChart3, Clock, ArrowUpRight, ArrowDownRight,
  Play, RefreshCw,
} from "lucide-react";
import type { Agent, Trade, EvolutionCycle, ActivityLogEntry } from "@shared/schema";

interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalCapital: number;
  totalTrades: number;
  totalPnl: number;
  avgWinRate: number;
  totalCycles: number;
  bestAgent: Agent | null;
}

export default function ClawraDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/clawra/dashboard"],
    refetchInterval: 5000,
  });

  const { data: recentTrades, isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/clawra/trades", "?limit=10"],
  });

  const { data: activity, isLoading: activityLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/clawra/activity", "?limit=20"],
  });

  const { data: cycles } = useQuery<EvolutionCycle[]>({
    queryKey: ["/api/clawra/cycles"],
  });

  const evolveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/clawra/evolve"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/lineage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/mutations"] });
    },
  });

  return (
    <div className="space-y-6" data-testid="clawra-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
            CLAWRA Control Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Closed-Loop Autonomous Wallet & Redistribution Architecture
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            System Active
          </Badge>
          <Button
            onClick={() => evolveMutation.mutate()}
            disabled={evolveMutation.isPending}
            className="gap-2"
            data-testid="button-evolve"
          >
            {evolveMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Run Evolution
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Agents"
          value={stats?.activeAgents}
          subtitle={`${stats?.totalAgents || 0} total`}
          icon={Bot}
          loading={statsLoading}
        />
        <StatCard
          title="Total P&L"
          value={stats?.totalPnl !== undefined ? `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(4)} SOL` : undefined}
          subtitle={`${stats?.totalTrades || 0} trades`}
          icon={DollarSign}
          loading={statsLoading}
          trend={stats?.totalPnl !== undefined ? (stats.totalPnl >= 0 ? "up" : "down") : undefined}
        />
        <StatCard
          title="Avg Win Rate"
          value={stats?.avgWinRate !== undefined ? `${(stats.avgWinRate * 100).toFixed(1)}%` : undefined}
          subtitle="across active agents"
          icon={Target}
          loading={statsLoading}
        />
        <StatCard
          title="Evolution Cycles"
          value={stats?.totalCycles}
          subtitle={`${stats?.totalCapital?.toFixed(2) || '0'} SOL capital`}
          icon={Activity}
          loading={statsLoading}
        />
      </div>

      {stats?.bestAgent && (
        <Card data-testid="card-best-agent">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Top Performing Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg" data-testid="text-best-agent-name">
                    {stats.bestAgent.name}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {stats.bestAgent.strategy.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">Score</p>
                <p className="text-2xl font-bold text-primary" data-testid="text-best-score">
                  {stats.bestAgent.performanceScore.toFixed(3)}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">
                  {(stats.bestAgent.winRate * 100).toFixed(0)}%
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">P&L</p>
                <p className={`text-2xl font-bold ${stats.bestAgent.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.bestAgent.totalPnl >= 0 ? '+' : ''}{stats.bestAgent.totalPnl.toFixed(4)}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">Generation</p>
                <p className="text-2xl font-bold">
                  Gen {stats.bestAgent.generation}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-recent-trades">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Recent Trades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px]">
              {tradesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTrades?.slice(0, 10).map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`row-trade-${trade.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {trade.direction === "long" ? (
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{trade.token}</p>
                          <p className="text-xs text-muted-foreground">
                            Agent #{trade.agentId} | {trade.direction.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-sm font-medium ${(trade.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {(trade.pnl || 0) >= 0 ? '+' : ''}{(trade.pnl || 0).toFixed(4)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card data-testid="card-activity-feed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px]">
              {activityLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {activity?.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-2 rounded-lg"
                      data-testid={`row-activity-${entry.id}`}
                    >
                      <div className="mt-0.5">
                        <ActivityIcon type={entry.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{entry.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {cycles && cycles.length > 0 && (
        <Card data-testid="card-evolution-history">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Evolution History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Cycle</th>
                    <th className="text-right py-2 px-3 font-medium">Alive</th>
                    <th className="text-right py-2 px-3 font-medium">Killed</th>
                    <th className="text-right py-2 px-3 font-medium">Spawned</th>
                    <th className="text-right py-2 px-3 font-medium">Avg Score</th>
                    <th className="text-right py-2 px-3 font-medium">Capital</th>
                    <th className="text-right py-2 px-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.slice(0, 10).map((cycle) => (
                    <tr key={cycle.id} className="border-b border-border/50" data-testid={`row-cycle-${cycle.id}`}>
                      <td className="py-2 px-3 font-mono">#{cycle.cycleNumber}</td>
                      <td className="py-2 px-3 text-right">{cycle.agentsAlive}</td>
                      <td className="py-2 px-3 text-right text-red-400">{cycle.agentsKilled}</td>
                      <td className="py-2 px-3 text-right text-green-400">{cycle.agentsSpawned}</td>
                      <td className="py-2 px-3 text-right font-mono">{cycle.avgScore.toFixed(3)}</td>
                      <td className="py-2 px-3 text-right font-mono">{cycle.totalCapital.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground text-xs">
                        {new Date(cycle.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  trend,
}: {
  title: string;
  value: string | number | undefined;
  subtitle: string;
  icon: any;
  loading: boolean;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className={`text-2xl font-bold ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : ""}`}>
                {value ?? "—"}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "birth":
      return <div className="h-2 w-2 rounded-full bg-green-500" />;
    case "death":
      return <div className="h-2 w-2 rounded-full bg-red-500" />;
    case "clone":
      return <div className="h-2 w-2 rounded-full bg-blue-500" />;
    case "cycle":
      return <div className="h-2 w-2 rounded-full bg-purple-500" />;
    case "mutation":
      return <div className="h-2 w-2 rounded-full bg-yellow-500" />;
    default:
      return <div className="h-2 w-2 rounded-full bg-muted-foreground" />;
  }
}
