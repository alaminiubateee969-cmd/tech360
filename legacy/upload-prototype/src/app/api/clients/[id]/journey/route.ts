import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT","STAFF"], req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const steps = await db.clientJourneyStep.findMany({ where: { clientId: id }, orderBy: { stepOrder: "asc" } });
  const ALL = [
    { name: "lead-created", label: "Lead Created", order: 1 },
    { name: "business-detected", label: "Business Type Detected", order: 2 },
    { name: "plan-recommended", label: "Plan Recommended", order: 3 },
    { name: "scope-questions", label: "Scope Questions Asked", order: 4 },
    { name: "scope-received", label: "Scope Received", order: 5 },
    { name: "ai-review", label: "AI Review Completed", order: 6 },
    { name: "final-scope", label: "Final Scope of Work", order: 7 },
    { name: "project-plan", label: "Project Plan + Timeline", order: 8 },
    { name: "payment-policy", label: "Payment Policy Sent", order: 9 },
    { name: "admin-approval", label: "Admin Approval Gate", order: 10 },
    { name: "scope-sent", label: "Approved Scope Sent", order: 11 },
    { name: "client-approval", label: "Client Approval/Revision", order: 12 },
    { name: "meeting-scheduled", label: "Meeting Scheduled", order: 13 },
    { name: "html-preview", label: "HTML Preview Before Payment", order: 14 },
    { name: "payment-tracking", label: "Payment Tracking", order: 15 },
    { name: "project-execution", label: "Project Execution", order: 16 },
    { name: "testing", label: "Testing", order: 17 },
    { name: "final-delivery", label: "Final Delivery", order: 18 },
    { name: "payment-verification", label: "Full Payment Verification", order: 19 },
    { name: "handover", label: "Source-Code/File/Admin Handover", order: 20 },
    { name: "password-changed", label: "Client Changed Passwords", order: 21 },
    { name: "review-requested", label: "Review + Recommendation Requested", order: 22 },
    { name: "project-closed", label: "Project Closed", order: 23 },
  ];
  const map = new Map(steps.map(s => [s.stepName, s]));
  const timeline = ALL.map(s => ({ ...s, completed: map.has(s.name) }));
  const completed = timeline.filter(t => t.completed).length;
  return NextResponse.json({ clientId: id, totalSteps: ALL.length, completedSteps: completed, progress: Math.round((completed / ALL.length) * 100), timeline });
}
