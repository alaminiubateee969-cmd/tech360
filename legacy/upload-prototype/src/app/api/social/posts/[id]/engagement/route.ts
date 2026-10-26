import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Real DB-backed engagement counts for a social post.
 * Replaces the previous hardcoded `24 / 6 / 2 / 1` engagement bar.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = await db.socialPost.findUnique({
    where: { id },
    select: {
      id: true,
      likes: true,
      comments: true,
      shares: true,
      bookmarks: true,
      _count: { select: { replies: true } },
    },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  return NextResponse.json({
    engagement: {
      likes: post.likes,
      comments: post.comments + post._count.replies,
      shares: post.shares,
      bookmarks: post.bookmarks,
    },
  });
}
