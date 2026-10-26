import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { decision?: string; note?: string; reviewerId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const decision = body.decision?.toUpperCase();
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  const approval = await db.aIApprovalRequest.findUnique({ where: { id } });
  if (!approval) {
    return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
  }
  if (approval.status !== "PENDING") {
    return NextResponse.json({ error: `Already ${approval.status}` }, { status: 400 });
  }

  const updated = await db.aIApprovalRequest.update({
    where: { id },
    data: {
      status: decision,
      reviewerId: body.reviewerId ?? "reviewer",
      reviewedAt: new Date(),
      reviewNote: body.note ?? null,
    },
  });

  await db.aIHumanReview.create({
    data: {
      executionId: approval.executionId,
      agentId: approval.agentId,
      reviewerId: body.reviewerId ?? "reviewer",
      decision: decision.toLowerCase(),
      comment: body.note ?? null,
    },
  });

  await db.aIAuditLog.create({
    data: {
      actorType: "user",
      actorId: body.reviewerId ?? "reviewer",
      action: `approval-${decision.toLowerCase()}`,
      entityType: "AIApprovalRequest",
      entityId: id,
      metadata: JSON.stringify({ note: body.note ?? null }),
    },
  });

  return NextResponse.json({ approval: updated });
}
