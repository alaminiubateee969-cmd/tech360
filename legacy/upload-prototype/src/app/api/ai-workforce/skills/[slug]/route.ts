import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const skill = await db.aISkill.findUnique({
    where: { slug },
    include: {
      versions: { orderBy: { version: "desc" }, take: 5 },
      tests: { take: 5 },
      _count: { select: { agents: true } },
    },
  });
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }
  const agentLinks = await db.aIAgentSkill.findMany({
    where: { skillId: skill.id },
    take: 50,
    include: {
      agent: {
        select: { id: true, slug: true, name: true, role: true, department: { select: { slug: true, name: true } } },
      },
    },
  });
  return NextResponse.json({ skill, agents: agentLinks });
}
