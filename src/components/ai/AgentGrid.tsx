"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bot,
  Crown,
  Users,
  MessageCircle,
  FileText,
  Scale,
  Camera,
  CreditCard,
  CalendarClock,
  PenSquare,
  Share2,
  Palette,
  Clapperboard,
  BookOpen,
  BrainCircuit,
  Mail,
  Search,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  HeartHandshake,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { apiFetch, formatRelative } from "@/lib/api";
import { StatusBadge } from "../crm/shared/StatusBadge";

interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: string;
  skillPath: string;
  lastAction: string | null;
  config: string;
  _count: { runs: number };
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "CEO Strategist": Crown,
  "CRM Manager": Users,
  "WhatsApp Agent": MessageCircle,
  "Scope Builder": FileText,
  "Legal Reviewer": Scale,
  "Evidence Tracker": Camera,
  "Payment Verifier": CreditCard,
  "Meeting Scheduler": CalendarClock,
  "Content Writer": PenSquare,
  "Social Media Manager": Share2,
  "Brand Designer": Palette,
  "Video Producer": Clapperboard,
  "Knowledge Curator": BookOpen,
  "Memory Keeper": BrainCircuit,
  "Email Composer": Mail,
  "SEO Optimizer": Search,
  "Error Monitor": AlertTriangle,
  "Approval Gatekeeper": ShieldCheck,
  "Analytics Insights": BarChart3,
  "Client Success": HeartHandshake,
};

export function AgentGrid() {
  const { data, isLoading } = useQuery<{ agents: Agent[] }>({
    queryKey: ["agents"],
    queryFn: () => apiFetch<{ agents: Agent[] }>("/api/agents"),
    refetchInterval: 30000,
  });
  const setAiSelectedAgentId = useAppStore((s) => s.setAiSelectedAgentId);

  const agents = data?.agents ?? [];
  const onlineCount = agents.filter((a) => a.status === "ONLINE").length;
  const busyCount = agents.filter((a) => a.status === "BUSY").length;

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total agents</div>
          <div className="mt-1 text-2xl font-bold">{agents.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Online</div>
          <div className="mt-1 text-2xl font-bold text-emerald-500">{onlineCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Busy</div>
          <div className="mt-1 text-2xl font-bold text-amber-500">{busyCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total runs</div>
          <div className="mt-1 text-2xl font-bold">
            {agents.reduce((s, a) => s + a._count.runs, 0)}
          </div>
        </Card>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))
          : agents.map((a, i) => {
              const Icon = ICONS[a.name] ?? Bot;
              const status = a.status;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: (i % 8) * 0.03 }}
                >
                  <Card
                    onClick={() => setAiSelectedAgentId(a.id)}
                    className="group h-full cursor-pointer p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary transition-transform group-hover:scale-110">
                        <Icon className="size-5" />
                        <span
                          className={cn(
                            "absolute -right-0.5 -top-0.5 size-3 rounded-full ring-2 ring-card",
                            status === "ONLINE" && "bg-emerald-500",
                            status === "BUSY" && "bg-amber-500 animate-pulse",
                            status === "OFFLINE" && "bg-muted-foreground/40"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{a.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.role}</div>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                      {a.description}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
                      <StatusBadge kind="agent" value={a.status} />
                      <span className="text-[10px] text-muted-foreground">
                        {a._count.runs} runs
                      </span>
                    </div>

                    {a.lastAction && (
                      <p className="mt-2 truncate text-[10px] text-muted-foreground" title={a.lastAction}>
                        Last: {a.lastAction}
                      </p>
                    )}
                  </Card>
                </motion.div>
              );
            })}
      </div>
    </div>
  );
}
