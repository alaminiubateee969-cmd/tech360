import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const reviews = await db.review.findMany({ where: { isPublic: true, isApproved: true }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ reviews });
}
