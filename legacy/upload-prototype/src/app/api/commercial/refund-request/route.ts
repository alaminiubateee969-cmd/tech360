import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/commercial/refund-request
// Body: { clientId, projectId, invoiceId, paymentRef, paymentDate, reason, description }
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES", "SUPPORT"], req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { clientId, projectId, invoiceId, paymentRef, paymentDate, reason, description } = body as Record<string, unknown>;

  if (!clientId || !reason) {
    return NextResponse.json({ error: "Missing clientId or reason" }, { status: 400 });
  }

  // Generate refund ID
  const count = await db.refundRequest.count();
  const refundId = `REF-2026-${String(count + 1).padStart(6, "0")}`;

  // Create refund request — status = REFUND_REQUESTED (NOT REFUNDED)
  const refund = await db.refundRequest.create({
    data: {
      refundId,
      clientId: clientId as string,
      projectId: (projectId as string) || null,
      invoiceId: (invoiceId as string) || null,
      paymentRef: (paymentRef as string) || null,
      paymentDate: paymentDate ? new Date(paymentDate as string) : null,
      reason: reason as string,
      description: (description as string) || null,
      status: "REFUND_REQUESTED",
    },
  });

  // Audit log
  await db.commercialAuditLog.create({
    data: {
      clientId: clientId as string,
      projectId: (projectId as string) || null,
      action: "refund_requested",
      actorType: "client",
      actorId: auth.session.user.id,
      details: JSON.stringify({ refundId, reason }),
    },
  });

  return NextResponse.json({
    message: "Refund request submitted. A refund request does not guarantee approval.",
    refundId: refund.refundId,
    status: "REFUND_REQUESTED",
    nextStep: "TECH360 LLC will review the request and respond according to the Refund Policy and applicable law.",
  }, { status: 201 });
}

// GET — list refund requests (admin only)
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "FINANCE"], req);
  if (!auth.ok) return auth.response;

  const requests = await db.refundRequest.findMany({ take: 50, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ requests });
}
