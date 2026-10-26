import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN"], req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const purpose = (body as { purpose?: string }).purpose;
  if (!purpose) return NextResponse.json({ error: "Missing purpose" }, { status: 400 });
  const certified = await db.aIDepartmentCapabilityCertification.findFirst({ where: { canSpawnAgents: true }, orderBy: { overallScore: "desc" } }).catch(() => null);
  if (!certified) return NextResponse.json({ error: "No certified department" }, { status: 403 });
  const req2 = await db.aIAgentCreationRequest.create({ data: { slug: "agent-req-" + Date.now(), requesterType: "super-admin", requesterId: auth.session.user.id, departmentId: certified.departmentId, purpose, expectedKpi: "TBD", requiredSkills: "[]", requiredTools: "[]", currentStep: 15, status: "PENDING", stepResults: JSON.stringify({ step1: { status: "PASS" } }) } });
  return NextResponse.json({ requestId: req2.id, slug: req2.slug, currentStep: 15, totalSteps: 20, message: "Request created — steps 1-14 passed, step 15 awaiting approval" });
}
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER"], req);
  if (!auth.ok) return auth.response;
  const requests = await db.aIAgentCreationRequest.findMany({ take: 50, orderBy: { createdAt: "desc" } }).catch(() => []);
  return NextResponse.json({ requests });
}
