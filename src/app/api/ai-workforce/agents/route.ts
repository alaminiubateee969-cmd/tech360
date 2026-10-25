import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const departmentSlug = searchParams.get("departmentSlug") || searchParams.get("department") || undefined;
  const role = searchParams.get("role") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "50")));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (departmentSlug) {
    // If it looks like a cuid, use it directly; otherwise treat as slug
    if (departmentSlug.length > 20) {
      where.departmentId = departmentSlug;
    } else {
      where.department = { slug: departmentSlug };
    }
  }
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { slug: { contains: search } },
      { description: { contains: search } },
      { role: { contains: search } },
    ];
  }

  const [agents, total] = await Promise.all([
    db.aIAgent.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { slug: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        role: true,
        status: true,
        version: true,
        humanApprovalRequired: true,
        department: { select: { id: true, slug: true, name: true } },
        _count: {
          select: {
            skills: true,
            prompts: true,
            executions: true,
            permissions: true,
          },
        },
      },
    }),
    db.aIAgent.count({ where }),
  ]);

  return NextResponse.json({
    agents,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
