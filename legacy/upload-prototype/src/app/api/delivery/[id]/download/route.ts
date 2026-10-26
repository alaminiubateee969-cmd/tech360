import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

// GET /api/delivery/[id]/download?token=xxx — download delivery package
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "ACCESS_DENIED", message: "Signed URL token required" }, { status: 403 });
  }

  const release = await db.deliveryRelease.findUnique({ where: { deliveryId: id } });

  if (!release) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // ENFORCE: Payment must be verified
  if (release.paymentStatus !== "VERIFIED") {
    return NextResponse.json({
      error: "PAYMENT_NOT_VERIFIED",
      message: "Source code download is BLOCKED. Payment status: " + release.paymentStatus,
      blocked: true,
    }, { status: 403 });
  }

  // ENFORCE: Admin approval required
  if (release.adminApproval !== "APPROVED") {
    return NextResponse.json({
      error: "ADMIN_APPROVAL_REQUIRED",
      message: "Delivery download requires admin approval. Current: " + release.adminApproval,
      blocked: true,
    }, { status: 403 });
  }

  // ENFORCE: Token must match
  if (release.accessToken !== token) {
    return NextResponse.json({ error: "INVALID_TOKEN", message: "Access denied" }, { status: 403 });
  }

  // ENFORCE: URL must not be expired
  if (release.signedUrlExpiry && release.signedUrlExpiry < new Date()) {
    return NextResponse.json({ error: "LINK_EXPIRED", message: "Signed URL has expired. Request a new delivery release." }, { status: 403 });
  }

  // ENFORCE: Client must confirm password rotation before final access
  if (!release.passwordRotationComplete) {
    return NextResponse.json({
      error: "PASSWORD_ROTATION_REQUIRED",
      message: "Client must complete password rotation before final delivery access.",
      checklist: [
        "Hosting password", "Database password", "Admin password",
        "Email password", "Cloud credentials", "API keys",
        "Git credentials", "SSH keys", "Payment gateway keys", "WhatsApp credentials"
      ],
    }, { status: 403 });
  }

  // All checks passed — return delivery package info
  return NextResponse.json({
    deliveryId: release.deliveryId,
    status: "ACCESS_GRANTED",
    packageHash: release.packageHash,
    accessStatus: release.accessStatus,
    message: "Delivery package ready for download.",
    contents: [
      "source-code.zip", "database-schema.sql", "deployment-docs.md",
      "admin-docs.md", "env-template.env", "third-party-notices.md", "handover-doc.md"
    ],
    note: "Actual secrets are NOT included. Client must configure own credentials.",
  });
}
