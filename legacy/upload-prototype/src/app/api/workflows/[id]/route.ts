import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wf = await db.workflow.findUnique({
    where: { id },
    include: { _count: { select: { runs: true } } },
  });
  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ workflow: wf });
}

/**
 * Update an existing workflow. Body may include any subset of:
 *   { name, description, triggerType, triggerConfig, nodes, edges, active }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["SUPER_ADMIN", "MANAGER"], req);
  if (!auth.ok) return auth.response;
  const userId = auth.session.user.id;

  const { id } = await params;
  const existing = await db.workflow.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as {
    name?: string;
    description?: string;
    triggerType?: string;
    triggerConfig?: unknown;
    nodes?: unknown;
    edges?: unknown;
    active?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.triggerType !== undefined) data.triggerType = body.triggerType;
  if (body.triggerConfig !== undefined) data.triggerConfig = JSON.stringify(body.triggerConfig);
  if (body.nodes !== undefined) data.nodes = JSON.stringify(body.nodes);
  if (body.edges !== undefined) data.edges = JSON.stringify(body.edges);
  if (body.active !== undefined) data.active = body.active;

  const workflow = await db.workflow.update({ where: { id }, data });

  await db.auditLog.create({
    data: {
      userId,
      action: "workflow.updated",
      entityType: "workflow",
      entityId: id,
      metadata: JSON.stringify({ fields: Object.keys(data) }),
    },
  });

  return NextResponse.json({ workflow });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["SUPER_ADMIN", "MANAGER"], req);
  if (!auth.ok) return auth.response;
  const userId = auth.session.user.id;
  const { id } = await params;
  await db.workflowRun.deleteMany({ where: { workflowId: id } });
  await db.workflow.delete({ where: { id } });
  await db.auditLog.create({
    data: {
      userId,
      action: "workflow.deleted",
      entityType: "workflow",
      entityId: id,
      metadata: JSON.stringify({}),
    },
  });
  return NextResponse.json({ ok: true });
}
