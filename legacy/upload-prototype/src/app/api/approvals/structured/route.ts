import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","ADMIN","PROJECT_MANAGER","SALES"], req);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const where = clientId ? { clientId } : {};
  const approvals = await db.structuredApproval.findMany({ where, take: 50, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ approvals });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const count = await db.structuredApproval.count();
  const approvalId = `APR-2026-${String(count + 1).padStart(6, "0")}`;
  const approval = await db.structuredApproval.create({
    data: {
      approvalId,
      clientId: body.clientId,
      projectId: body.projectId || null,
      scopeVersion: body.scopeVersion,  // SOW-v1.3
      approvalType: body.approvalType || "SCOPE",
      approvalText: body.approvalText || "I APPROVE THE SCOPE",
      emailAddress: body.emailAddress,
      messageId: body.messageId || null,
      ipAddress: body.ipAddress || null,
      userAgent: body.userAgent || null,
      approvedBy: body.approvedBy,
      status: body.status || "PENDING",
      scopeSnapshot: JSON.stringify(body.scopeSnapshot || {}),
    },
  });
  return NextResponse.json({ approval }, { status: 201 });
}
