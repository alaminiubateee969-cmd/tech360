import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/commercial/scope-approval
// Body: { scopeId, clientId, termsAccepted, refundPolicyAccepted, previewAcknowledged, scopeReviewed, termsRead, refundPolicyRead, ipAddress, userAgent }
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES"], req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { scopeId, clientId, termsAccepted, refundPolicyAccepted, previewAcknowledged, scopeReviewed, termsRead, refundPolicyRead, ipAddress, userAgent } = body as Record<string, unknown>;

  if (!scopeId) return NextResponse.json({ error: "Missing scopeId" }, { status: 400 });

  // ENFORCE: All 6 checkboxes must be checked
  const checkboxes = { scopeReviewed, termsRead, refundPolicyRead, termsAccepted, refundPolicyAccepted, previewAcknowledged };
  const unchecked = Object.entries(checkboxes).filter(([_, v]) => !v).map(([k]) => k);
  if (unchecked.length > 0) {
    return NextResponse.json({
      error: "ALL_CHECKBOXES_REQUIRED",
      message: "All acknowledgment checkboxes must be checked before approval.",
      unchecked,
    }, { status: 400 });
  }

  // Load scope
  const scope = await db.scope.findUnique({ where: { id: scopeId as string } });
  if (!scope) return NextResponse.json({ error: "Scope not found" }, { status: 404 });

  // ENFORCE: Cannot approve an already-approved scope (must create new version)
  if (scope.status === "APPROVED") {
    return NextResponse.json({
      error: "SCOPE_ALREADY_APPROVED",
      message: "This scope version is already approved and immutable. Create a new version for changes.",
    }, { status: 403 });
  }

  // Create immutable snapshot of the approved scope
  const snapshot = JSON.stringify({
    id: scope.id,
    title: scope.title,
    deliverables: scope.deliverables,
    timeline: scope.timeline,
    budget: scope.budget,
    scopeVersion: scope.scopeVersion,
    approvedAt: new Date().toISOString(),
  });

  // Update scope to APPROVED + immutable
  const updated = await db.scope.update({
    where: { id: scopeId as string },
    data: {
      status: "APPROVED",
      termsAccepted: true,
      refundPolicyAccepted: true,
      previewAcknowledged: true,
      immutableSnapshot: snapshot,
      approvedAt: new Date(),
      approvedByClient: auth.session.user.id,
    },
  });

  // Create StructuredApproval record
  const count = await db.structuredApproval.count();
  const approvalId = `APR-2026-${String(count + 1).padStart(6, "0")}`;
  await db.structuredApproval.create({
    data: {
      approvalId,
      clientId: (clientId as string) || scope.clientId || "",
      projectId: scope.projectId,
      scopeVersion: scope.scopeVersion,
      approvalType: "SCOPE",
      approvalText: "I APPROVE THE SCOPE",
      emailAddress: auth.session.user.email,
      ipAddress: (ipAddress as string) || null,
      userAgent: (userAgent as string) || null,
      approvedBy: auth.session.user.name || auth.session.user.email,
      status: "APPROVED",
      scopeSnapshot: snapshot,
    },
  });

  // Audit log
  await db.commercialAuditLog.create({
    data: {
      clientId: (clientId as string) || scope.clientId || null,
      projectId: scope.projectId,
      scopeId: scope.id,
      action: "scope_approved",
      actorType: "client",
      actorId: auth.session.user.id,
      details: JSON.stringify({ scopeVersion: scope.scopeVersion, approvalId, termsAccepted: true, refundPolicyAccepted: true }),
      ipAddress: (ipAddress as string) || null,
      userAgent: (userAgent as string) || null,
    },
  });

  // Update project commercial state
  await (db.project.update as any)({
    where: { id: scope.projectId },
    data: { commercialState: "SCOPE_APPROVED" },
  }).catch(() => {});

  return NextResponse.json({
    message: "Scope approved successfully. Full project payment is now required.",
    scopeId: scope.id,
    scopeVersion: scope.scopeVersion,
    approvalId,
    nextState: "PAYMENT_REQUIRED",
  }, { status: 200 });
}
