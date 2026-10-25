import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const agent = await db.aIAgent.findUnique({
    where: { slug },
    include: {
      department: true,
      capabilities: true,
      skills: { include: { skill: true }, take: 30 },
      prompts: { where: { status: "ACTIVE" }, take: 25, orderBy: { slug: "asc" } },
      permissions: true,
      tools: { include: { tool: true } },
      modelRoutingPolicy: { include: { primaryModel: true } },
      fallbackPolicy: true,
      versions: { orderBy: { version: "desc" }, take: 5 },
      feedback: { take: 5, orderBy: { createdAt: "desc" } },
      incidents: { take: 5, orderBy: { createdAt: "desc" } },
      evaluations: { take: 3, include: { metrics: true } },
      _count: {
        select: {
          skills: true,
          prompts: true,
          executions: true,
          permissions: true,
          memory: true,
        },
      },
    },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const recentExecutions = await db.aITaskExecution.findMany({
    where: { agentId: agent.id },
    take: 5,
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      durationMs: true,
      modelUsed: true,
      startedAt: true,
      tokenInput: true,
      tokenOutput: true,
    },
  });

  return NextResponse.json({ agent, recentExecutions });
}
