"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface AnalyticsData {
  leadsBySource: Array<{ source: string; count: number }>;
  leadsByStatus: Array<{ status: string; count: number }>;
  paymentsByMethod: Array<{ method: string; count: number; total: number }>;
  agentPerformance: Array<{ id: string; name: string; role: string; status: string; runs: number }>;
  revenueBySource: Array<{ source: string; amount: number }>;
  responseTimes: Array<{ label: string; ms: number }>;
}

const COLORS = ["#F59E0B", "#10B981", "#8B5CF6", "#F43F5E", "#0EA5E9", "#FACC15"];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

export function AnalyticsCharts() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: () => apiFetch<AnalyticsData>("/api/analytics"),
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Leads by source */}
        <Card className="p-5">
          <h3 className="font-semibold">Leads by source</h3>
          <p className="text-xs text-muted-foreground">Where pipeline is born</p>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.leadsBySource} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="source"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {data.leadsBySource.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Leads by status */}
        <Card className="p-5">
          <h3 className="font-semibold">Pipeline by status</h3>
          <p className="text-xs text-muted-foreground">Lead funnel distribution</p>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.leadsByStatus}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {data.leadsByStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Revenue by source */}
        <Card className="p-5">
          <h3 className="font-semibold">Revenue by source</h3>
          <p className="text-xs text-muted-foreground">Paid revenue tied to lead attribution</p>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueBySource} margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="source" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(v: number) => `$${v.toLocaleString()}`}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Agent performance */}
        <Card className="p-5">
          <h3 className="font-semibold">Agent performance</h3>
          <p className="text-xs text-muted-foreground">Run counts over the last 30 days</p>
          <div className="mt-4 max-h-60 overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Agent</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 text-right font-medium">Runs</th>
                </tr>
              </thead>
              <tbody>
                {data.agentPerformance.map((a) => (
                  <tr key={a.id} className="border-t border-border/40">
                    <td className="py-2 font-medium">{a.name}</td>
                    <td className="py-2 text-muted-foreground">{a.role}</td>
                    <td className="py-2 text-right font-mono">{a.runs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Response time trend */}
      <Card className="p-5">
        <h3 className="font-semibold">Agent response time</h3>
        <p className="text-xs text-muted-foreground">Milliseconds per agent run (lower is better)</p>
        <div className="mt-4 h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.responseTimes} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="ms"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ fill: "#8B5CF6", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
