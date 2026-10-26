import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const tools = await db.aIAgentTool.findMany({
    orderBy: { slug: "asc" },
    include: { _count: { select: { agents: true } } },
  });
  return NextResponse.json({ tools });
}
