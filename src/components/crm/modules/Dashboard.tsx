"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  FolderKanban,
  DollarSign,
  CheckSquare,
  Bot,
  MessageSquare,
  Workflow,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, formatMoney, formatRelative } from "@/lib/api";

interface DashboardStats {
  stats: {
    totalLeads: number;
    activeProjects: number;
    monthlyRevenue: number;
    pendingApprovals: number;
    onlineAgents: number;
    unreadConversations: number;
    activeWorkflows: number;
  };
  leadsByDay: Array<{ date: string; label: string; count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    user: string;
    when: string;
  }>;
}

const STAT_CARDS = [
  { key: "totalLeads", label: "Total Leads", icon: Users, accent: "text-amber-500", bg: "bg-amber-500/10" },
  { key: "activeProjects", label: "Active Projects", icon: FolderKanban, accent: "text-emerald-500", bg: "bg-emerald-500/10" },
  { key: "monthlyRevenue", label: "Monthly Revenue", icon: DollarSign, accent: "text-violet-500", bg: "bg-violet-500/10", money: true },
  { key: "pendingApprovals", label: "Pending Approvals", icon: CheckSquare, accent: "text-rose-500", bg: "bg-rose-500/10" },
] as const;

const SECONDARY = [
  { key: "onlineAgents", label: "Agents online", icon: Bot, color: "text-emerald-500" },
  { key: "unreadConversations", label: "Unread chats", icon: MessageSquare, color: "text-amber-500" },
  { key: "activeWorkflows", label: "Active workflows", icon: Workflow, color: "text-violet-500" },
] as const;

export function Dashboard() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiFetch<DashboardStats>("/api/dashboard/stats"),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          const value = data.stats[s.key];
          return (
            <Card key={s.key} className="p-5 transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">
                    {"money" in s && s.money ? formatMoney(value as number) : value}
                  </p>
                </div>
                <div className={`grid size-10 place-items-center rounded-lg ${s.bg} ${s.accent}`}>
                  <Icon className="size-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SECONDARY.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.key} className="flex items-center gap-4 p-4">
              <div className={`grid size-10 place-items-center rounded-lg bg-muted ${s.color}`}>
                <Icon className="size-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{data.stats[s.key]}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Chart + activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Leads — last 30 days</h3>
              <p className="text-xs text-muted-foreground">
                Inbound across all sources
              </p>
            </div>
            <Badge variant="secondary" className="gap-1.5">
              <TrendingUp className="size-3" />
              Live
            </Badge>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.leadsByDay}>
                <defs>
                  <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--popover-foreground)" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  fill="url(#leadGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Recent activity</h3>
          <p className="text-xs text-muted-foreground">Last 10 admin actions</p>
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto scrollbar-thin">
            {data.recentActivity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No activity yet
              </p>
            ) : (
              data.recentActivity.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{a.user}</span>{" "}
                      <span className="text-muted-foreground">{a.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelative(a.when)} · {a.entityType}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
