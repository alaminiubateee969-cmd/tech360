"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Users,
  Sparkles,
  FileText,
  ClipboardList,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Cpu,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch, formatRelative } from "@/lib/api";
import type { Stats, Incident } from "./types";

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

export function Monitoring() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["ai-workforce", "stats"],
    queryFn: () => apiFetch<Stats>("/api/ai-workforce/stats"),
    refetchInterval: 30000,
  });

  const { data: incidentData } = useQuery<{ incidents: Incident[] }>({
    queryKey: ["ai-workforce", "incidents"],
    queryFn: () => apiFetch<{ incidents: Incident[] }>("/api/ai-workforce/incidents"),
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const c = stats.counts;
  const cards = [
    { label: "Total Agents", value: c.totalAgents, icon: Users, color: "text-blue-500" },
    { label: "Active Agents", value: c.activeAgents, icon: TrendingUp, color: "text-emerald-500" },
    { label: "Skills", value: c.totalSkills, icon: Sparkles, color: "text-violet-500" },
    { label: "Prompts", value: c.totalPrompts, icon: FileText, color: "text-amber-500" },
    { label: "SOPs", value: c.totalSops, icon: ClipboardList, color: "text-rose-500" },
    { label: "Departments", value: c.totalDepartments, icon: Building2, color: "text-cyan-500" },
    { label: "Execs Today", value: c.executionsToday, icon: Activity, color: "text-indigo-500" },
    { label: "Pending Approvals", value: c.pendingApprovals, icon: ShieldCheck, color: "text-amber-500" },
    { label: "Open Incidents", value: c.openIncidents, icon: AlertTriangle, color: "text-red-500" },
    { label: "Total Execs", value: c.totalExecutions, icon: Activity, color: "text-blue-500" },
    { label: "Tools", value: c.totalTools, icon: Cpu, color: "text-teal-500" },
    { label: "Models", value: c.totalModels, icon: Cpu, color: "text-fuchsia-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center justify-between">
                <Icon className={`size-4 ${card.color}`} />
              </div>
              <div className="mt-2 text-2xl font-bold tabular-nums">
                {card.value.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground">{card.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Executions over time */}
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Executions — Last 7 Days</h3>
          {stats.executionsOverTime.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No executions in the last 7 days. Run an agent to populate this chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.executionsOverTime}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 10, fill: "currentColor" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="success" stackId="a" fill="#10b981" name="Success" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By department */}
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Executions by Department (Top 10)</h3>
          {stats.executionsByDepartment.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No department data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stats.executionsByDepartment}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={45}
                  paddingAngle={2}
                >
                  {stats.executionsByDepartment.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Success rate + incidents */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Success Rate (7d)</h3>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="text-4xl font-bold tabular-nums">{stats.successRate}%</div>
            <div className="mt-1 text-xs text-muted-foreground">of recent executions succeeded</div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Incidents</h3>
            <Badge variant="secondary" className="text-[10px]">
              {incidentData?.incidents.length ?? 0}
            </Badge>
          </div>
          <ScrollArea className="max-h-64 scrollbar-thin">
            {!incidentData || incidentData.incidents.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                No incidents reported. The system is healthy.
              </div>
            ) : (
              <div className="space-y-2">
                {incidentData.incidents.slice(0, 10).map((inc) => (
                  <div key={inc.id} className="flex items-start gap-2 rounded-md bg-muted/30 p-2">
                    <Badge
                      variant="outline"
                      className={
                        inc.severity === "critical"
                          ? "text-[10px] text-red-600 dark:text-red-400"
                          : inc.severity === "high"
                          ? "text-[10px] text-amber-600 dark:text-amber-400"
                          : "text-[10px]"
                      }
                    >
                      {inc.severity}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{inc.type}</span>
                        <span className="text-[10px] text-muted-foreground">{formatRelative(inc.createdAt)}</span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{inc.description}</p>
                      <p className="text-[10px] text-muted-foreground">{inc.agent.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
