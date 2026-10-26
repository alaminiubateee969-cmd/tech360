import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT","STAFF"], req);
  if (!auth.ok) return auth.response;
  const files = await db.fileItem.findMany({ take: 100, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ files });
}
