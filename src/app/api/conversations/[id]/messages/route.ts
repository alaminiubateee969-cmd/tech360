import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });
  const conversation = await db.conversation.findUnique({ where: { id } });

  // Mark unread as read on view.
  if (conversation && conversation.unreadCount > 0) {
    await db.conversation.update({ where: { id }, data: { unreadCount: 0 } });
  }

  return NextResponse.json({ conversation, messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text: string = (body.body ?? "").toString().trim();
  if (!text) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const conv = await db.conversation.findUnique({ where: { id } });
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const msg = await db.message.create({
    data: {
      conversationId: id,
      channel: conv.channel,
      direction: "OUTBOUND",
      from: "+8801327100297",
      to: conv.contactHandle,
      body: text,
      status: "SENT",
    },
  });

  await db.conversation.update({
    where: { id },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json({ message: msg }, { status: 201 });
}
