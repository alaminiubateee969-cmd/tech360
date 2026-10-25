import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const posts = await db.blogPost.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 20, select: { id: true, slug: true, title: true, excerpt: true, author: true, category: true, publishedAt: true } });
  return NextResponse.json({ posts });
}
