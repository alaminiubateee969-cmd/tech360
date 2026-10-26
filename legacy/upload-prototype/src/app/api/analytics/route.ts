import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns analytics aggregates for the Analytics tab.
export async function GET() {
  const [leadsBySource, leadsByStatus, paymentsByMethod, agents, agentRuns] = await Promise.all([
    db.lead.groupBy({ by: ["source"], _count: { _all: true } }),
    db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    db.payment.groupBy({ by: ["method"], _count: { _all: true }, _sum: { amount: true } }),
    db.agent.findMany({ include: { _count: { select: { runs: true } } } }),
    db.agentRun.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  // Revenue by source — sum paid payments per lead source (best-effort join via project leads).
  const paidPayments = await db.payment.findMany({
    where: { status: "PAID" },
    include: { project: { include: { leads: { select: { source: true } } } } },
  });
  const revBySource: Record<string, number> = {};
  for (const p of paidPayments) {
    const sources = new Set(p.project?.leads.map((l) => l.source) ?? []);
    for (const s of sources) {
      revBySource[s] = (revBySource[s] ?? 0) + p.amount;
    }
    if (sources.size === 0) {
      revBySource["DIRECT"] = (revBySource["DIRECT"] ?? 0) + p.amount;
    }
  }

  // Response-time trend (mocked from agent run durations).
  const responseTimes = agentRuns.map((r) => ({
    label: new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ms: r.durationMs,
  }));

  return NextResponse.json({
    leadsBySource: leadsBySource.map((s) => ({ source: s.source, count: s._count._all })),
    leadsByStatus: leadsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
    paymentsByMethod: paymentsByMethod.map((m) => ({
      method: m.method,
      count: m._count._all,
      total: m._sum.amount ?? 0,
    })),
    agentPerformance: agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      status: a.status,
      runs: a._count.runs,
    })),
    revenueBySource: Object.entries(revBySource).map(([source, amount]) => ({ source, amount })),
    responseTimes,
  });
}
