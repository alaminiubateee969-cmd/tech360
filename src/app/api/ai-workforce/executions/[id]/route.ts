import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const execution = await db.aITaskExecution.findUnique({
    where: { id },
    include: {
      agent: {
        select: { id: true, slug: true, name: true, role: true, department: { select: { slug: true, name: true } } },
      },
      logs: { orderBy: { createdAt: "asc" } },
      results: true,
    },
  });
  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }
  return NextResponse.json({ execution });
}
