import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/legal
 * Public list of all active legal pages (for nav).
 */
export async function GET() {
  const pages = await db.legalPage.findMany({
    where: { status: "ACTIVE" },
    select: {
      slug: true,
      title: true,
      version: true,
      updatedAt: true,
    },
    orderBy: { title: "asc" },
  });

  return NextResponse.json({ pages });
}
