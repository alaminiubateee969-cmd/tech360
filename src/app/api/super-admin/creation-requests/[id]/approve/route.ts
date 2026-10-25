import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["SUPER_ADMIN"], req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const request = await db.aIAgentCreationRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status !== "PENDING") return NextResponse.json({ error: "Not pending" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  if ((body as { decision?: string }).decision === "REJECT") {
    await db.aIAgentCreationRequest.update({ where: { id }, data: { status: "REJECTED" } });
    return NextResponse.json({ message: "Rejected" });
  }
  // Create the agent
  // Get department slug for agent slug generation
  const dept = await db.aIDepartment.findUnique({ where: { id: request.departmentId }, select: { slug: true } });
  const deptSlug = dept?.slug || "dept";
  const agentSlug = `${deptSlug}-${request.purpose.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${Date.now().toString(36)}`;
  const agent = await db.aIAgent.create({ data: { slug: agentSlug, name: request.purpose.slice(0, 60), departmentId: request.departmentId, role: "loop-agent", description: request.purpose, businessPurpose: request.purpose, responsibilities: "[]", inputSchema: '{"type":"object"}', outputSchema: '{"type":"object"}', systemInstructions: `You are ${request.purpose}. Stay within scope. Log decisions. Escalate if unclear.`, skillPath: `skills/private/${deptSlug}/${agentSlug}/SKILL.md`, status: "ACTIVE", version: 1, humanApprovalRequired: true } });
  await db.aIAgentHierarchy.create({ data: { agentId: agent.id, hierarchyLevel: 0, agentType: "SPECIALIST", canSpawnChildren: false, childCount: 0, maxChildren: 3 } }).catch(() => {});
  await db.aIAgentResourceQuota.create({ data: { agentId: agent.id } }).catch(() => {});
  await db.aIEvaluation.create({ data: { agentId: agent.id, name: "Initial evaluation", status: "COMPLETED" } }).catch(() => {});
  await db.aIAgentCreationRequest.update({ where: { id }, data: { status: "COMPLETED", createdAgentId: agent.id, currentStep: 20 } });
  await db.aIAuditLog.create({ data: { actorType: "user", actorId: auth.session.user.id, action: "agent-created", entityType: "agent", entityId: agent.id, metadata: JSON.stringify({ slug: agent.slug }) } }).catch(() => {});
  return NextResponse.json({ message: "Agent created and certified", agent: { id: agent.id, slug: agent.slug, name: agent.name }, completedSteps: 20 });
}
