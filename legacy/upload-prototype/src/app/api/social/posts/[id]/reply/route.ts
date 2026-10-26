import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Real reply — creates a Message row linked to a SocialPost and bumps
 * the post's comment count. Used by the SocialInbox reply box.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["SUPER_ADMIN", "MANAGER", "AGENT", "STAFF"], req);
  if (!auth.ok) return auth.response;
  const userId = auth.session.user.id;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const { id: postId } = await params;
  let body: { body?: string; conversationId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const post = await db.socialPost.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Find or create a conversation for this social post so the message
  // has a parent (Message.conversationId is required).
  let conversationId = body.conversationId;
  if (!conversationId) {
    const conv = await db.conversation.create({
      data: {
        channel: post.channel,
        contactName: post.authorName,
        contactHandle: post.authorHandle,
      },
    });
    conversationId = conv.id;
  }

  const message = await db.message.create({
    data: {
      conversationId,
      channel: post.channel,
      direction: "OUTBOUND",
      from: user?.email ?? "tech360",
      to: post.authorHandle,
      body: body.body,
      status: "SENT",
      socialPostId: post.id,
    },
  });

  // Bump the real comments counter on the post.
  await db.socialPost.update({
    where: { id: post.id },
    data: { comments: { increment: 1 } },
  });

  await db.auditLog.create({
    data: {
      userId,
      action: "social.reply",
      entityType: "SocialPost",
      entityId: post.id,
      metadata: JSON.stringify({ messageId: message.id }),
    },
  });

  return NextResponse.json({ message, conversationId }, { status: 201 });
}
