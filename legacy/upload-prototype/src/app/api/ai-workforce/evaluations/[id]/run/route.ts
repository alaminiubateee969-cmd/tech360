import { NextRequest, NextResponse } from "next/server";
import { runEvaluation } from "@/lib/ai-eval";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = await runEvaluation(id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Evaluation failed" }, { status: 500 });
  }
}
