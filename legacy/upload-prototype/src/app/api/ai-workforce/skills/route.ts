import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("search") || undefined;
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "50")));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (category) where.category = { contains: category };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { slug: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [skills, total] = await Promise.all([
    db.aISkill.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { slug: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        status: true,
        version: true,
        _count: { select: { agents: true } },
      },
    }),
    db.aISkill.count({ where }),
  ]);

  return NextResponse.json({
    skills,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
