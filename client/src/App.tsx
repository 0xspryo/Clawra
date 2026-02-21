import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ClawraDashboard from "@/pages/clawra-dashboard";
import ClawraAgents from "@/pages/clawra-agents";
import ClawraEvolution from "@/pages/clawra-evolution";
import ClawraAnalytics from "@/pages/clawra-analytics";
import {
  Wallet, Bot, LayoutDashboard, Users, GitBranch,
  BarChart3, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { path: "/", label: "Wallet Tools", icon: Wallet, section: "tools" },
  { path: "/clawra", label: "Dashboard", icon: LayoutDashboard, section: "clawra" },
  { path: "/clawra/agents", label: "Agents", icon: Users, section: "clawra" },
  { path: "/clawra/evolution", label: "Evolution", icon: GitBranch, section: "clawra" },
  { path: "/clawra/analytics", label: "Analytics", icon: BarChart3, section: "clawra" },
];

function Sidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
      data-testid="sidebar"
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
        <Bot className="h-6 w-6 text-primary shrink-0" />
        {!collapsed && (
          <span className="font-bold text-sm tracking-tight">CLAWRA</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-sidebar-accent transition-colors"
          data-testid="button-toggle-sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 py-3 space-y-1 px-2">
        {!collapsed && (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
            Solana Tools
          </p>
        )}
        {NAV_ITEMS.filter(n => n.section === "tools").map((item) => {
          const isActive = location === item.path;
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}

        <div className="my-3 mx-2 h-px bg-sidebar-border" />

        {!collapsed && (
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
            CLAWRA System
          </p>
        )}
        {NAV_ITEMS.filter(n => n.section === "clawra").map((item) => {
          const isActive = location === item.path;
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">System Online</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/clawra" component={ClawraDashboard} />
      <Route path="/clawra/agents" component={ClawraAgents} />
      <Route path="/clawra/evolution" component={ClawraEvolution} />
      <Route path="/clawra/analytics" component={ClawraAnalytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            <Router />
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
