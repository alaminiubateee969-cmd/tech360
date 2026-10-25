import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT","STAFF"], req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { stepName, stepOrder } = body as Record<string, unknown>;
  if (!stepName) return NextResponse.json({ error: "Missing stepName" }, { status: 400 });
  const step = await db.clientJourneyStep.create({ data: { clientId: id, stepName: stepName as string, stepOrder: (stepOrder as number) || 0, status: "COMPLETED", performedBy: auth.session.user.id, data: JSON.stringify(body.data || {}) } });
  return NextResponse.json({ step }, { status: 201 });
}
