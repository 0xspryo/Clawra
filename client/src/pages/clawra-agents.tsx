import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bot, Plus, TrendingUp, TrendingDown, Skull, Shield,
  Dna, Clock, Target, BarChart3, ArrowUpRight, ArrowDownRight, Crosshair,
} from "lucide-react";
import type { Agent, Trade, Mutation } from "@shared/schema";

interface AgentDetail {
  agent: Agent;
  trades: Trade[];
  mutations: Mutation[];
  children: Agent[];
}

export default function ClawraAgents() {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/clawra/agents"],
    refetchInterval: 10000,
  });

  const { data: agentDetail, isLoading: detailLoading } = useQuery<AgentDetail>({
    queryKey: ["/api/clawra/agents", selectedAgentId],
    enabled: !!selectedAgentId,
  });

  const spawnMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/clawra/agents/spawn"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clawra/lineage"] });
    },
  });

  const activeAgents = agents?.filter(a => a.status === "active") || [];
  const deadAgents = agents?.filter(a => a.status === "dead") || [];

  return (
    <div className="space-y-6" data-testid="clawra-agents">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-agents-title">Agent Registry</h1>
          <p className="text-muted-foreground mt-1">
            {activeAgents.length} active | {deadAgents.length} eliminated | {agents?.length || 0} total
          </p>
        </div>
        <Button
          onClick={() => spawnMutation.mutate()}
          disabled={spawnMutation.isPending}
          className="gap-2"
          data-testid="button-spawn-agent"
        >
          <Plus className="h-4 w-4" />
          Spawn Agent
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active-agents">
              Active ({activeAgents.length})
            </TabsTrigger>
            <TabsTrigger value="dead" data-testid="tab-dead-agents">
              Eliminated ({deadAgents.length})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all-agents">
              All ({agents?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <AgentGrid agents={activeAgents} onSelect={setSelectedAgentId} />
          </TabsContent>
          <TabsContent value="dead">
            <AgentGrid agents={deadAgents} onSelect={setSelectedAgentId} />
          </TabsContent>
          <TabsContent value="all">
            <AgentGrid agents={agents || []} onSelect={setSelectedAgentId} />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!selectedAgentId} onOpenChange={() => setSelectedAgentId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {agentDetail?.agent.name || "Loading..."}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : agentDetail ? (
            <AgentDetailView detail={agentDetail} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentGrid({ agents, onSelect }: { agents: Agent[]; onSelect: (id: number) => void }) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Bot className="h-12 w-12 mb-3 opacity-40" />
        <p>No agents found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <Card
          key={agent.id}
          className={`cursor-pointer transition-all hover:border-primary/50 ${agent.status === "dead" ? "opacity-60" : ""}`}
          onClick={() => onSelect(agent.id)}
          data-testid={`card-agent-${agent.id}`}
        >
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${agent.status === "active" ? "bg-primary/10" : "bg-muted"}`}>
                  {agent.status === "active" ? (
                    <Bot className="h-4 w-4 text-primary" />
                  ) : (
                    <Skull className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">Gen {agent.generation} | Age {agent.age}</p>
                </div>
              </div>
              <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-xs">
                {agent.status}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1">
              {agent.strategy.map((s) => (
                <Badge key={s} variant="outline" className="text-xs py-0">
                  {s}
                </Badge>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="font-mono text-sm font-medium">{agent.performanceScore.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="font-mono text-sm font-medium">{(agent.winRate * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">P&L</p>
                <p className={`font-mono text-sm font-medium ${agent.totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {agent.totalPnl >= 0 ? "+" : ""}{agent.totalPnl.toFixed(3)}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Risk Profile</span>
                <span>{(agent.riskProfile * 100).toFixed(0)}%</span>
              </div>
              <Progress value={agent.riskProfile * 100} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AgentDetailView({ detail }: { detail: AgentDetail }) {
  const { agent, trades, mutations, children } = detail;

  return (
    <ScrollArea className="flex-1 overflow-auto">
      <div className="space-y-6 p-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat icon={Target} label="Score" value={agent.performanceScore.toFixed(3)} />
          <MiniStat icon={BarChart3} label="Win Rate" value={`${(agent.winRate * 100).toFixed(1)}%`} />
          <MiniStat
            icon={agent.totalPnl >= 0 ? TrendingUp : TrendingDown}
            label="Total P&L"
            value={`${agent.totalPnl >= 0 ? "+" : ""}${agent.totalPnl.toFixed(4)}`}
            color={agent.totalPnl >= 0 ? "text-green-500" : "text-red-500"}
          />
          <MiniStat icon={Crosshair} label="Trades" value={agent.totalTrades.toString()} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Parameters</h4>
            <div className="space-y-2 text-sm">
              <ParamRow label="Risk Profile" value={agent.riskProfile} />
              <ParamRow label="Position Size" value={agent.positionSize} />
              <ParamRow label="Trade Frequency" value={agent.tradeFrequency} />
              <ParamRow label="Signal Threshold" value={agent.signalThreshold} />
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Identity</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Generation</span>
                <span className="font-mono">{agent.generation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Age</span>
                <span className="font-mono">{agent.age} cycles</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital</span>
                <span className="font-mono">{agent.capitalAllocated.toFixed(2)} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asset Pref</span>
                <Badge variant="outline" className="text-xs">{agent.assetPreference}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parent</span>
                <span className="font-mono">{agent.parentId ? `#${agent.parentId}` : "Origin"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs font-mono text-muted-foreground bg-muted/50 rounded-lg p-2 break-all">
          Wallet: {agent.walletAddress}
        </div>

        {mutations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Dna className="h-3.5 w-3.5" /> Mutation History ({mutations.length})
            </h4>
            <div className="space-y-1.5">
              {mutations.slice(0, 8).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                  <span className="font-mono">{m.parameter}</span>
                  <span className="text-muted-foreground">
                    {m.oldValue.toFixed(3)} <span className="mx-1">→</span>
                    <span className={m.newValue > m.oldValue ? "text-green-400" : "text-red-400"}>
                      {m.newValue.toFixed(3)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {trades.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Recent Trades ({trades.length})
            </h4>
            <div className="space-y-1.5">
              {trades.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    {t.direction === "long" ? (
                      <ArrowUpRight className="h-3 w-3 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-500" />
                    )}
                    <span className="font-medium">{t.token}</span>
                    <span className="text-muted-foreground">{t.quantity.toFixed(2)} qty</span>
                  </div>
                  <span className={`font-mono ${(t.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(t.pnl || 0) >= 0 ? "+" : ""}{(t.pnl || 0).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {children.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Offspring ({children.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {children.map((c) => (
                <Badge key={c.id} variant={c.status === "active" ? "default" : "secondary"} className="text-xs">
                  {c.name} (Gen {c.generation})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color || "text-muted-foreground"}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono text-sm font-semibold ${color || ""}`}>{value}</p>
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(3)}</span>
      </div>
      <Progress value={value * 100} className="h-1" />
    </div>
  );
}
