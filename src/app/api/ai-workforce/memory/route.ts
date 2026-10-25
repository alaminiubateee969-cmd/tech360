import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveMemory, recallMemory, listMemory } from "@/lib/ai-memory";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const action = searchParams.get("action") || "list";
  const query = searchParams.get("q") || "";

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  if (action === "recall") {
    if (!query) return NextResponse.json({ error: "q is required for recall" }, { status: 400 });
    const memories = await recallMemory(agentId, query, 10);
    return NextResponse.json({ memories });
  }

  const memories = await listMemory(agentId, 50);
  return NextResponse.json({ memories });
}

export async function POST(req: NextRequest) {
  let body: { agentId?: string; type?: string; key?: string; value?: string; metadata?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.agentId || !body.type || !body.key || !body.value) {
    return NextResponse.json({ error: "agentId, type, key, value are required" }, { status: 400 });
  }
  const result = await saveMemory(
    body.agentId,
    body.type as "session" | "long-term" | "episodic",
    body.key,
    body.value,
    body.metadata
  );
  return NextResponse.json(result);
}
