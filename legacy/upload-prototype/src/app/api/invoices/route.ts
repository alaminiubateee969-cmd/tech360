import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT","STAFF"], req);
  if (!auth.ok) return auth.response;
  const items = await db.invoice.findMany({ take: 100, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ invoices: items });
}
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT"], req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const item = await db.invoice.create({ data: body });
  return NextResponse.json({ invoices: item }, { status: 201 });
}
