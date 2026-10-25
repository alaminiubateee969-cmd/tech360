import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","STAFF"], req);
  if (!auth.ok) return auth.response;
  const reviews = await db.review.findMany({ take: 50, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ reviews });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const review = await db.review.create({ data: { rating: Number(body.rating) || 5, title: body.title || null, content: body.content || null, authorName: body.authorName || null, authorRole: body.authorRole || null, isPublic: Boolean(body.isPublic), isApproved: false } });
  return NextResponse.json({ review }, { status: 201 });
}
