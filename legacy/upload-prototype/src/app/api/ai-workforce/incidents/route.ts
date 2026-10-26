import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reportIncident } from "@/lib/ai-eval";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  const incidents = await db.aIAgentIncident.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      agent: { select: { id: true, slug: true, name: true, role: true, department: { select: { slug: true, name: true } } } },
    },
  });
  return NextResponse.json({ incidents });
}

export async function POST(req: NextRequest) {
  let body: { agentId?: string; severity?: string; type?: string; description?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.agentId || !body.severity || !body.type || !body.description) {
    return NextResponse.json({ error: "agentId, severity, type, description are required" }, { status: 400 });
  }
  const validSeverities = ["low", "medium", "high", "critical"];
  if (!validSeverities.includes(body.severity)) {
    return NextResponse.json({ error: "severity must be low|medium|high|critical" }, { status: 400 });
  }
  const result = await reportIncident(
    body.agentId,
    body.severity as "low" | "medium" | "high" | "critical",
    body.type,
    body.description
  );
  return NextResponse.json(result);
}
