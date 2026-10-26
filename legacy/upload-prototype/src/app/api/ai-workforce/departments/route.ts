import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const departments = await db.aIDepartment.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      company: { select: { id: true, slug: true, name: true } },
      _count: { select: { agents: true } },
    },
  });
  return NextResponse.json({ departments });
}
