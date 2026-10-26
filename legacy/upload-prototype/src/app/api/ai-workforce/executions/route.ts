import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentSlug = searchParams.get("agentSlug") || undefined;
  const status = searchParams.get("status") || undefined;
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "50")));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (agentSlug) {
    const agent = await db.aIAgent.findUnique({ where: { slug: agentSlug }, select: { id: true } });
    if (!agent) return NextResponse.json({ executions: [], pagination: { page, pageSize, total: 0, totalPages: 0 } });
    where.agentId = agent.id;
  }

  const [executions, total] = await Promise.all([
    db.aITaskExecution.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        durationMs: true,
        modelUsed: true,
        tokenInput: true,
        tokenOutput: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
        agent: { select: { id: true, slug: true, name: true, role: true, department: { select: { slug: true, name: true } } } },
      },
    }),
    db.aITaskExecution.count({ where }),
  ]);

  return NextResponse.json({
    executions,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
