import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const departmentSlug = searchParams.get("departmentSlug");
  const where: Record<string, unknown> = {};
  if (departmentSlug) {
    const dep = await db.aIDepartment.findUnique({ where: { slug: departmentSlug }, select: { id: true } });
    if (!dep) return NextResponse.json({ sops: [] });
    where.departmentId = dep.id;
  }
  const sops = await db.aISOP.findMany({
    where,
    orderBy: { slug: "asc" },
    take: 100,
    include: {
      department: { select: { slug: true, name: true } },
      _count: { select: { tests: true } },
    },
  });
  return NextResponse.json({ sops });
}
