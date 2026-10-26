import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT","STAFF"], req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id }, include: { lead: true, projects: { orderBy: { createdAt: "desc" } }, tasks: { take: 20 }, invoices: { orderBy: { createdAt: "desc" } }, meetings: { take: 10 }, evidence: { take: 20 }, communications: { take: 20 }, files: { take: 20 }, reviews: true, journeySteps: { orderBy: { stepOrder: "asc" } }, _count: { select: { projects: true, tasks: true, invoices: true, meetings: true, evidence: true, communications: true, files: true } } } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ client });
}
