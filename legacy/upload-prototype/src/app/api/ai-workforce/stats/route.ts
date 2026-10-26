import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalAgents,
    activeAgents,
    totalSkills,
    totalPrompts,
    totalSops,
    totalDepartments,
    executionsToday,
    pendingApprovals,
    openIncidents,
    totalExecutions,
    totalTools,
    totalModels,
  ] = await Promise.all([
    db.aIAgent.count(),
    db.aIAgent.count({ where: { status: "ACTIVE" } }),
    db.aISkill.count(),
    db.aIPrompt.count(),
    db.aISOP.count(),
    db.aIDepartment.count(),
    db.aITaskExecution.count({ where: { startedAt: { gte: startOfDay } } }),
    db.aIApprovalRequest.count({ where: { status: "PENDING" } }),
    db.aIAgentIncident.count({ where: { status: "OPEN" } }),
    db.aITaskExecution.count(),
    db.aIAgentTool.count(),
    db.aIModel.count(),
  ]);

  // Executions over last 7 days (deterministic bucketing by date).
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentExecutions = await db.aITaskExecution.findMany({
    where: { startedAt: { gte: sevenDaysAgo } },
    select: { status: true, startedAt: true, agent: { select: { department: { select: { slug: true, name: true } } } } },
    take: 1000,
  });

  const byDay: Record<string, { total: number; success: number; failed: number }> = {};
  for (const e of recentExecutions) {
    const day = e.startedAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, success: 0, failed: 0 };
    byDay[day].total++;
    if (e.status === "SUCCESS") byDay[day].success++;
    if (e.status === "FAILED") byDay[day].failed++;
  }
  const executionsOverTime = Object.entries(byDay)
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const byDepartment: Record<string, { name: string; count: number }> = {};
  for (const e of recentExecutions) {
    const depSlug = e.agent?.department?.slug ?? "unknown";
    const depName = e.agent?.department?.name ?? "Unknown";
    if (!byDepartment[depSlug]) byDepartment[depSlug] = { name: depName, count: 0 };
    byDepartment[depSlug].count++;
  }
  const executionsByDepartment = Object.entries(byDepartment)
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const successRate = totalExecutions > 0
    ? Number(((recentExecutions.filter((e) => e.status === "SUCCESS").length / Math.max(1, recentExecutions.length)) * 100).toFixed(1))
    : 0;

  return NextResponse.json({
    counts: {
      totalAgents,
      activeAgents,
      totalSkills,
      totalPrompts,
      totalSops,
      totalDepartments,
      executionsToday,
      pendingApprovals,
      openIncidents,
      totalExecutions,
      totalTools,
      totalModels,
    },
    executionsOverTime,
    executionsByDepartment,
    successRate,
  });
}
