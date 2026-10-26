import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * List social posts (optionally filtered by channel) with real
 * DB-backed engagement counts. Public read — used by the SocialInbox.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const limit = Math.min(50, Number(searchParams.get("limit") ?? "30"));

  const where: Record<string, unknown> = {};
  if (channel) where.channel = channel;

  const posts = await db.socialPost.findMany({
    where,
    orderBy: { postedAt: "desc" },
    take: limit,
    include: {
      _count: { select: { replies: true } },
    },
  });

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      channel: p.channel,
      authorName: p.authorName,
      authorHandle: p.authorHandle,
      body: p.body,
      postedAt: p.postedAt,
      engagement: {
        likes: p.likes,
        comments: p.comments + p._count.replies,
        shares: p.shares,
        bookmarks: p.bookmarks,
      },
    })),
  });
}
