import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/super-admin/agents/command
// Body: { agentSlug: string, command: "pause" | "resume" | "restart" | "evaluate" | "rollback" | "view-memory" | "view-audit" }
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN"], req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { agentSlug, command } = body as { agentSlug?: string; command?: string };
  const valid = ["pause", "resume", "restart", "evaluate", "rollback", "view-memory", "view-audit"];
  if (!agentSlug || !command || !valid.includes(command)) {
    return NextResponse.json({ error: `Need agentSlug + command (${valid.join(", ")})` }, { status: 400 });
  }

  const agent = await db.aIAgent.findUnique({ where: { slug: agentSlug } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  let result: Record<string, unknown> = {};
  switch (command) {
    case "pause":
      await db.aIAgent.update({ where: { id: agent.id }, data: { status: "PAUSED" } });
      result = { previousStatus: agent.status, newStatus: "PAUSED" };
      break;
    case "resume":
    case "restart":
      await db.aIAgent.update({ where: { id: agent.id }, data: { status: "ACTIVE" } });
      result = { previousStatus: agent.status, newStatus: "ACTIVE" };
      break;
    case "evaluate": {
      const evals = await db.aIEvaluation.findMany({ where: { agentId: agent.id }, take: 5, include: { metrics: true } });
      result = { evaluations: evals };
      break;
    }
    case "rollback": {
      const versions = await db.aIAgentVersion.findMany({ where: { agentId: agent.id }, orderBy: { version: "desc" }, take: 2 });
      result = { versions: versions.map(v => ({ version: v.version, createdAt: v.createdAt })) };
      break;
    }
    case "view-memory": {
      const memory = await db.aIAgentMemory.findMany({ where: { agentId: agent.id }, take: 10, orderBy: { createdAt: "desc" } });
      result = { memoryItems: memory };
      break;
    }
    case "view-audit": {
      const audit = await db.aIAuditLog.findMany({ where: { entityType: "agent", entityId: agent.id }, take: 10, orderBy: { createdAt: "desc" } });
      result = { auditEntries: audit };
      break;
    }
  }

  const log = await db.agentCommandLog.create({
    data: {
      agentId: agent.id,
      command,
      requestedBy: auth.session.user.id,
      status: "EXECUTED",
      result: JSON.stringify(result),
    },
  });

  return NextResponse.json({ command, agent: agent.slug, result, logId: log.id });
}
