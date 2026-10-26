import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/commercial/payment-verify
// Body: { paymentId, transactionId, providerTransactionId, verifiedAmount, verifiedCurrency }
// ONLY admin can verify payment — never trust frontend payment status
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "FINANCE"], req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { paymentId, transactionId, providerTransactionId, verifiedAmount, verifiedCurrency } = body as Record<string, unknown>;

  if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });

  // Load payment
  const payment = await db.payment.findUnique({ where: { id: paymentId as string }, include: { project: true } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  // ENFORCE: Cannot verify an already-paid payment (prevent double processing)
  if (payment.status === "PAID") {
    return NextResponse.json({
      error: "ALREADY_PAID",
      message: "This payment has already been verified. Duplicate processing prevented.",
    }, { status: 403 });
  }

  // ENFORCE: Verify scope is approved before payment can be confirmed
  const scope = await db.scope.findFirst({ where: { projectId: payment.projectId, status: "APPROVED" } });
  if (!scope) {
    return NextResponse.json({
      error: "SCOPE_NOT_APPROVED",
      message: "Payment cannot be verified. The project scope has not been approved.",
    }, { status: 403 });
  }

  // ENFORCE: Server-side amount verification (frontend cannot set amount)
  if (verifiedAmount !== undefined && verifiedAmount !== payment.amount) {
    return NextResponse.json({
      error: "AMOUNT_MISMATCH",
      message: `Verified amount (${verifiedAmount}) does not match invoice amount (${payment.amount}).`,
    }, { status: 400 });
  }

  // Verify payment — update to PAID
  const updated = await db.payment.update({
    where: { id: paymentId as string },
    data: {
      status: "PAID",
      transactionId: (providerTransactionId as string) || (transactionId as string) || null,
      verifiedBy: auth.session.user.id,
      verifiedAt: new Date(),
    },
  });

  // Update project to FINAL_DEVELOPMENT
  await (db.project.update as any)({
    where: { id: payment.projectId },
    data: { commercialState: "PAYMENT_PAID" },
  }).catch(() => {});

  // Audit log
  await db.commercialAuditLog.create({
    data: {
      clientId: payment.clientId || null,
      projectId: payment.projectId,
      paymentId: payment.id,
      action: "payment_verified",
      actorType: "admin",
      actorId: auth.session.user.id,
      details: JSON.stringify({ amount: payment.amount, currency: payment.currency, transactionId: updated.transactionId }),
    },
  });

  return NextResponse.json({
    message: "Payment verified successfully. Project has entered final development.",
    paymentId: payment.id,
    status: "PAID",
    projectState: "FINAL_DEVELOPMENT",
  }, { status: 200 });
}
