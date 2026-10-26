import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentSlug = searchParams.get("agentSlug");
  if (!agentSlug) {
    return NextResponse.json({ error: "agentSlug is required" }, { status: 400 });
  }
  const agent = await db.aIAgent.findUnique({
    where: { slug: agentSlug },
    select: { id: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  const prompts = await db.aIPrompt.findMany({
    where: { agentId: agent.id },
    orderBy: { slug: "asc" },
    take: 100,
  });
  return NextResponse.json({ prompts });
}
