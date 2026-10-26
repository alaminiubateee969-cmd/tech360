import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/super-admin/departments/[slug]/command
// Body: { command: "pause" | "resume" | "evaluate" | "certify" | "uncertify" | "health-check" | "dcc-test" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireRole(["SUPER_ADMIN"], req);
  if (!auth.ok) return auth.response;
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const command = (body as { command?: string }).command;
  const valid = ["pause", "resume", "evaluate", "certify", "uncertify", "health-check", "dcc-test"];
  if (!command || !valid.includes(command)) {
    return NextResponse.json({ error: `Invalid command. Valid: ${valid.join(", ")}` }, { status: 400 });
  }

  const dept = await db.aIDepartment.findUnique({ where: { slug }, include: { dcc: true, _count: { select: { agents: true, sops: true } } } });
  if (!dept) return NextResponse.json({ error: "Department not found" }, { status: 404 });

  let result: Record<string, unknown> = {};

  switch (command) {
    case "pause": {
      const updated = await db.aIAgent.updateMany({ where: { departmentId: dept.id, status: "ACTIVE" }, data: { status: "PAUSED" } });
      result = { message: `${updated.count} agents paused in ${dept.name}` };
      break;
    }
    case "resume": {
      const updated = await db.aIAgent.updateMany({ where: { departmentId: dept.id, status: "PAUSED" }, data: { status: "ACTIVE" } });
      result = { message: `${updated.count} agents resumed in ${dept.name}` };
      break;
    }
    case "certify": {
      if (dept.dcc) {
        await db.aIDepartmentCapabilityCertification.update({ where: { departmentId: dept.id }, data: { certified: true, certificationLevel: "GOLD", canSpawnAgents: true, lastEvaluatedAt: new Date() } });
      }
      result = { message: `${dept.name} force-certified to GOLD` };
      break;
    }
    case "uncertify": {
      if (dept.dcc) {
        await db.aIDepartmentCapabilityCertification.update({ where: { departmentId: dept.id }, data: { certified: false, certificationLevel: "NONE", canSpawnAgents: false, lastEvaluatedAt: new Date() } });
      }
      result = { message: `${dept.name} certification revoked` };
      break;
    }
    case "health-check":
    case "evaluate":
    case "dcc-test": {
      result = {
        department: dept.name,
        agents: dept._count.agents,
        sops: dept._count.sops,
        certified: dept.dcc?.certified ?? false,
        level: dept.dcc?.certificationLevel ?? "NONE",
        overallScore: dept.dcc?.overallScore ?? 0,
        health: (dept.dcc?.certified ?? false) ? "HEALTHY" : "DEGRADED",
      };
      break;
    }
  }

  const log = await db.departmentCommandLog.create({
    data: {
      departmentId: dept.id,
      command,
      requestedBy: auth.session.user.id,
      status: "EXECUTED",
      result: JSON.stringify(result),
    },
  });

  return NextResponse.json({ command, department: dept.name, result, logId: log.id });
}
