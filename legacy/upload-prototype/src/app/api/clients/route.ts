import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT","STAFF"], req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const { leadId, name, email, phone, company, businessType } = body as Record<string, unknown>;
  if (!name || !email) return NextResponse.json({ error: "Missing name or email" }, { status: 400 });
  const count = await db.client.count();
  const clientId = `TECH-2026-${String(count + 1).padStart(6, "0")}`;
  const client = await db.client.create({ data: { clientId, leadId: (leadId as string) || null, name: name as string, email: email as string, phone: (phone as string) || null, company: (company as string) || null, businessType: (businessType as string) || null, status: "ONBOARDING" } });
  await db.clientJourneyStep.create({ data: { clientId: client.id, stepName: "lead-created", stepOrder: 1, status: "COMPLETED", performedBy: auth.session.user.id, data: "{}" } });
  return NextResponse.json({ client, clientId }, { status: 201 });
}
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT","STAFF"], req);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const where: Record<string, unknown> = {};
  if (search) where.OR = [{ name: { contains: search } }, { email: { contains: search } }, { clientId: { contains: search } }];
  const clients = await db.client.findMany({ where, take: 100, orderBy: { createdAt: "desc" }, include: { _count: { select: { projects: true, invoices: true, tasks: true } } } });
  return NextResponse.json({ clients });
}
