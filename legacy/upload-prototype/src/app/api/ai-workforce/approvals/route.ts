import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "PENDING";
  const approvals = await db.aIApprovalRequest.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      agent: { select: { id: true, slug: true, name: true, role: true, department: { select: { slug: true, name: true } } } },
    },
  });
  return NextResponse.json({ approvals });
}
