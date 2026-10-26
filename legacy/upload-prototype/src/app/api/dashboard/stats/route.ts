import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [leads, activeProjects, payments, pendingApprovals, agents, conversations, workflows] =
    await Promise.all([
      db.lead.count(),
      db.project.count({ where: { status: { in: ["PLANNING", "IN_PROGRESS", "REVIEW"] } } }),
      db.payment.findMany({ where: { status: "PAID" } }),
      db.approval.count({ where: { status: "PENDING" } }),
      db.agent.count({ where: { status: "ONLINE" } }),
      db.conversation.count({ where: { unreadCount: { gt: 0 } } }),
      db.workflow.count({ where: { active: true } }),
    ]);

  const monthlyRevenue = payments.reduce((s, p) => s + p.amount, 0);

  // 30-day leads chart — group by day.
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const recentLeads = await db.lead.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, source: true },
  });

  const days: Array<{ date: string; label: string; count: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = recentLeads.filter(
      (l) => l.createdAt >= d && l.createdAt < next
    ).length;
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    });
  }

  // Revenue by source.
  const leadsBySource = await db.lead.groupBy({
    by: ["source"],
    _count: { _all: true },
  });
  const revenueBySource = leadsBySource.map((s) => ({
    source: s.source,
    count: s._count._all,
  }));

  // Recent activity feed.
  const recentAudit = await db.auditLog.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    stats: {
      totalLeads: leads,
      activeProjects,
      monthlyRevenue,
      pendingApprovals,
      onlineAgents: agents,
      unreadConversations: conversations,
      activeWorkflows: workflows,
    },
    leadsByDay: days,
    revenueBySource,
    recentActivity: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      user: a.user?.name ?? "system",
      when: a.createdAt,
    })),
  });
}
