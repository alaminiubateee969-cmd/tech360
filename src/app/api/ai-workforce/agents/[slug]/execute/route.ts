import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai-executor";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // The body may be { input: {...} } or the input object directly.
  const input = (body.input && typeof body.input === "object" ? body.input : body) as Record<string, unknown>;

  const agent = await db.aIAgent.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  if (agent.status !== "ACTIVE") {
    return NextResponse.json({ error: `Agent is ${agent.status}` }, { status: 400 });
  }

  try {
    const result = await executeAgent(slug, input);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
