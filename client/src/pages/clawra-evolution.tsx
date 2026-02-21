import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GitBranch, Bot, Skull, TrendingUp, Dna, Activity,
} from "lucide-react";
import type { Agent, EvolutionCycle, Mutation } from "@shared/schema";

interface LineageNode {
  id: number;
  name: string;
  parentId: number | null;
  generation: number;
  status: string;
  score: number;
  strategy: string[];
  age: number;
  pnl: number;
}

export default function ClawraEvolution() {
  const { data: lineage, isLoading: lineageLoading } = useQuery<LineageNode[]>({
    queryKey: ["/api/clawra/lineage"],
  });

  const { data: cycles, isLoading: cyclesLoading } = useQuery<EvolutionCycle[]>({
    queryKey: ["/api/clawra/cycles"],
  });

  const { data: allMutations } = useQuery<Mutation[]>({
    queryKey: ["/api/clawra/mutations"],
  });

  const maxGeneration = lineage ? Math.max(...lineage.map(n => n.generation)) : 1;
  const generations = Array.from({ length: maxGeneration }, (_, i) => i + 1);

  return (
    <div className="space-y-6" data-testid="clawra-evolution">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-evolution-title">
          Evolution & Lineage
        </h1>
        <p className="text-muted-foreground mt-1">
          Genetic lineage tree and mutation history across all generations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Generations</p>
                <p className="text-2xl font-bold">{maxGeneration}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Dna className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Mutations</p>
                <p className="text-2xl font-bold">{allMutations?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Evolution Cycles</p>
                <p className="text-2xl font-bold">{cycles?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-lineage-tree">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Lineage Tree
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lineageLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-6">
                {generations.map((gen) => {
                  const genAgents = lineage?.filter(n => n.generation === gen) || [];
                  if (genAgents.length === 0) return null;
                  return (
                    <div key={gen} className="space-y-2">
                      <div className="flex items-center gap-2 sticky top-0 bg-card z-10 py-1">
                        <Badge variant="outline" className="text-xs font-mono">
                          Generation {gen}
                        </Badge>
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">
                          {genAgents.length} agent{genAgents.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {genAgents.map((node) => (
                          <LineageCard key={node.id} node={node} allNodes={lineage || []} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {allMutations && allMutations.length > 0 && (
        <Card data-testid="card-mutation-log">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Dna className="h-4 w-4" />
              Recent Mutations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {allMutations.slice(0, 30).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-muted/30"
                    data-testid={`row-mutation-${m.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs font-mono py-0">
                        Agent #{m.agentId}
                      </Badge>
                      <span className="font-mono text-xs">{m.parameter}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-muted-foreground">{m.oldValue.toFixed(3)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={m.newValue > m.oldValue ? "text-green-400" : "text-red-400"}>
                        {m.newValue.toFixed(3)}
                      </span>
                      <span className={`text-xs ${m.newValue > m.oldValue ? "text-green-400" : "text-red-400"}`}>
                        ({m.newValue > m.oldValue ? "+" : ""}{((m.newValue - m.oldValue) / m.oldValue * 100).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LineageCard({ node, allNodes }: { node: LineageNode; allNodes: LineageNode[] }) {
  const parent = node.parentId ? allNodes.find(n => n.id === node.parentId) : null;
  const children = allNodes.filter(n => n.parentId === node.id);
  const isAlive = node.status === "active";

  return (
    <div
      className={`relative border rounded-lg p-3 space-y-2 transition-all ${
        isAlive
          ? "border-primary/30 bg-primary/5"
          : "border-border/50 bg-muted/20 opacity-70"
      }`}
      data-testid={`lineage-node-${node.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isAlive ? (
            <Bot className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Skull className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold truncate max-w-[120px]">{node.name}</span>
        </div>
        <span className={`text-xs font-mono ${node.score > 0 ? "text-green-400" : node.score < 0 ? "text-red-400" : "text-muted-foreground"}`}>
          {node.score.toFixed(3)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {node.strategy.map(s => (
          <span key={s} className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
            {s}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Age: {node.age}</span>
        <span className={node.pnl >= 0 ? "text-green-400" : "text-red-400"}>
          {node.pnl >= 0 ? "+" : ""}{node.pnl.toFixed(3)} SOL
        </span>
      </div>

      {(parent || children.length > 0) && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
          {parent && (
            <span>← {parent.name}</span>
          )}
          {children.length > 0 && (
            <span className="ml-auto">{children.length} offspring →</span>
          )}
        </div>
      )}
    </div>
  );
}
