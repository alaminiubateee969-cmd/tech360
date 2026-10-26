import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Bulk endpoint that returns all CRM list data in one round-trip.
// Keeps the single-page demo snappy without 13 separate fetches.
export async function GET() {
  const [
    projects,
    communications,
    scopes,
    payments,
    approvals,
    files,
    staff,
    knowledge,
    auditLog,
    users,
  ] = await Promise.all([
    db.project.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { leads: true } } } }),
    db.communication.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.scope.findMany({ orderBy: { createdAt: "desc" }, include: { project: true } }),
    db.payment.findMany({ orderBy: { createdAt: "desc" }, include: { project: true } }),
    db.approval.findMany({ orderBy: { createdAt: "desc" }, include: { requester: { select: { name: true } }, decider: { select: { name: true } } } }),
    db.fileItem.findMany({ orderBy: { createdAt: "desc" }, include: { project: true } }),
    db.staff.findMany({ include: { user: true } }),
    db.knowledgeArticle.findMany({ orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } }),
    db.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true } }),
  ]);

  return NextResponse.json({
    projects,
    communications,
    scopes,
    payments,
    approvals,
    files,
    staff,
    knowledge,
    auditLog,
    users,
  });
}
