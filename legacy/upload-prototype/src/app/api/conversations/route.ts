import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const conversations = await db.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  return NextResponse.json({ conversations });
}
