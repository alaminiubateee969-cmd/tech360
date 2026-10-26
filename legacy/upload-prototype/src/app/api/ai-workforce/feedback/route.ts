import { NextRequest, NextResponse } from "next/server";
import { submitFeedback } from "@/lib/ai-eval";

export async function POST(req: NextRequest) {
  let body: { agentId?: string; executionId?: string | null; rating?: number; comment?: string; submittedBy?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.agentId || typeof body.rating !== "number") {
    return NextResponse.json({ error: "agentId and rating are required" }, { status: 400 });
  }
  try {
    const result = await submitFeedback(
      body.agentId,
      body.executionId ?? null,
      body.rating,
      body.comment ?? null,
      body.submittedBy
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
