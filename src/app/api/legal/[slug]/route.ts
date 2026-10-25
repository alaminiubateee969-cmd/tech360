import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await db.legalPage.findUnique({ where: { slug } });
  if (!page || page.status !== "ACTIVE") return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ page });
}
