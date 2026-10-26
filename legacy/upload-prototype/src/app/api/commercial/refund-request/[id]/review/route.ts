import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/commercial/refund-request/[id]/review
// Body: { decision: "APPROVED" | "DENIED", resolution }
// ONLY SUPER_ADMIN/ADMIN/FINANCE can make refund decisions
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "FINANCE"], req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { decision, resolution } = body as Record<string, unknown>;

  if (!decision || !["APPROVED", "DENIED"].includes(decision as string)) {
    return NextResponse.json({ error: "Invalid decision. Must be APPROVED or DENIED." }, { status: 400 });
  }

  const refund = await db.refundRequest.findUnique({ where: { id } });
  if (!refund) return NextResponse.json({ error: "Refund request not found" }, { status: 404 });

  // Prevent re-reviewing already-decided refunds
  if (refund.status === "APPROVED" || refund.status === "DENIED" || refund.status === "REFUNDED") {
    return NextResponse.json({
      error: "ALREADY_DECIDED",
      message: `This refund request has already been ${refund.status}.`,
    }, { status: 403 });
  }

  const updated = await db.refundRequest.update({
    where: { id },
    data: {
      status: decision as string,
      reviewedBy: auth.session.user.id,
      reviewedAt: new Date(),
      decision: decision as string,
      resolution: (resolution as string) || null,
    },
  });

  // Audit log
  await db.commercialAuditLog.create({
    data: {
      clientId: refund.clientId,
      projectId: refund.projectId,
      action: `refund_${(decision as string).toLowerCase()}`,
      actorType: "admin",
      actorId: auth.session.user.id,
      details: JSON.stringify({ refundId: refund.refundId, decision, resolution }),
    },
  });

  return NextResponse.json({
    message: `Refund request ${(decision as string).toLowerCase()}.`,
    refundId: refund.refundId,
    status: decision as string,
  });
}
