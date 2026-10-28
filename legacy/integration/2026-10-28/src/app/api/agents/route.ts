import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await db.agent.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { runs: true } } },
  });
  return NextResponse.json({ agents });
}
