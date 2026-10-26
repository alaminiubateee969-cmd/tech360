import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/commercial/source-code-access?projectId=xxx
// Checks if source code can be released based on commercial workflow state
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "MANAGER"], req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  // Load project + payments + scope
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      payments: true,
      scopes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Check 1: Scope approved?
  const approvedScope = project.scopes.find(s => s.status === "APPROVED");
  const scopeApproved = !!approvedScope;

  // Check 2: Payment verified (PAID)?
  const paidPayment = project.payments.find(p => p.status === "PAID");
  const paymentVerified = !!paidPayment;

  // Check 3: Delivery release exists with admin approval?
  const delivery = await db.deliveryRelease.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  const deliveryApproved = delivery?.adminApproval === "APPROVED";
  const qaPassed = delivery?.qaStatus === "PASSED";
  const passwordRotationComplete = delivery?.passwordRotationComplete ?? false;

  // Determine access
  const sourceCodeAccessGranted = scopeApproved && paymentVerified && deliveryApproved && qaPassed && passwordRotationComplete;

  // Build response with clear status for each gate
  const gates = {
    scopeApproved: { status: scopeApproved ? "PASS" : "FAIL", message: scopeApproved ? "Scope approved" : "Scope not approved" },
    paymentVerified: { status: paymentVerified ? "PASS" : "FAIL", message: paymentVerified ? "Payment verified (PAID)" : "Payment not verified" },
    qaPassed: { status: qaPassed ? "PASS" : "FAIL", message: qaPassed ? "QA passed" : "QA not passed" },
    adminApproval: { status: deliveryApproved ? "PASS" : "FAIL", message: deliveryApproved ? "Admin approved delivery" : "Admin approval pending" },
    passwordRotation: { status: passwordRotationComplete ? "PASS" : "FAIL", message: passwordRotationComplete ? "Password rotation complete" : "Password rotation required" },
  };

  // If any gate fails, source code is BLOCKED
  if (!sourceCodeAccessGranted) {
    const failedGates = Object.entries(gates).filter(([_, v]) => v.status === "FAIL").map(([k]) => k);
    return NextResponse.json({
      sourceCodeAccess: "BLOCKED",
      message: "Source code access is BLOCKED. Required gates have not been passed.",
      gates,
      failedGates,
      blockedItems: ["source-code", "git-repository", "admin-credentials", "deployment-credentials"],
      allowedItems: ["html-preview", "screenshots", "demo-url", "design-review"],
    }, { status: 403 });
  }

  // All gates passed — source code can be released
  return NextResponse.json({
    sourceCodeAccess: "AUTHORIZED",
    message: "All gates passed. Source code access is authorized.",
    gates,
    deliveryId: delivery?.deliveryId,
    signedUrl: delivery?.signedUrl,
    signedUrlExpiry: delivery?.signedUrlExpiry,
  });
}
