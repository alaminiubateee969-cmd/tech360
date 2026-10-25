import { NextRequest, NextResponse } from "next/server";
import { randomBytes as cryptoRandomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";

// POST /api/delivery/release — create delivery release (admin only)
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN", "ADMIN"], req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { clientId, projectId, paymentVerified, qaPassed } = body as Record<string, unknown>;

  // ENFORCE: Payment must be verified before delivery release
  if (!paymentVerified) {
    return NextResponse.json({
      error: "PAYMENT_NOT_VERIFIED",
      message: "Source code delivery is BLOCKED until payment is verified.",
      blocked: ["source-code", "git-repository", "admin-credentials", "deployment-credentials"],
      allowed: ["html-preview", "screenshots", "demo-url", "design-review"],
    }, { status: 403 });
  }

  // ENFORCE: QA must pass before delivery release
  if (!qaPassed) {
    return NextResponse.json({
      error: "QA_NOT_PASSED",
      message: "Delivery release requires QA approval.",
    }, { status: 403 });
  }

  const count = await db.deliveryRelease.count();
  const deliveryId = `DEL-2026-${String(count + 1).padStart(6, "0")}`;

  // Generate signed URL (24-hour expiry)
  const accessToken = cryptoRandomBytes(32).toString("hex");
  const signedUrlExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const release = await db.deliveryRelease.create({
    data: {
      deliveryId,
      clientId: clientId as string,
      projectId: (projectId as string) || null,
      paymentStatus: "VERIFIED",
      qaStatus: "PASSED",
      adminApproval: "APPROVED",
      adminApprovedBy: auth.session.user.id,
      adminApprovedAt: new Date(),
      signedUrl: `/api/delivery/${deliveryId}/download?token=${accessToken}`,
      signedUrlExpiry,
      accessToken: accessToken,
      accessStatus: "TECH360_CONTROLLED",
    },
  });

  await db.aIAuditLog.create({
    data: {
      actorType: "user",
      actorId: auth.session.user.id,
      action: "delivery-release-created",
      entityType: "delivery",
      entityId: release.id,
      metadata: JSON.stringify({ deliveryId, clientId, paymentVerified, qaPassed }),
    },
  }).catch(() => {});

  return NextResponse.json({
    deliveryId,
    signedUrl: release.signedUrl,
    expiresAt: signedUrlExpiry,
    message: "Delivery release created. Source code access granted.",
  }, { status: 201 });
}
