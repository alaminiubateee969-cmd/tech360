import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER"], req);
  if (!auth.ok) return auth.response;
  const departments = await db.aIDepartment.findMany({ select: { id: true, slug: true, name: true, _count: { select: { agents: true, sops: true } }, dcc: { select: { certified: true, certificationLevel: true, overallScore: true } }, agents: { select: { id: true, slug: true, name: true, role: true, status: true }, take: 50, orderBy: { slug: "asc" } } }, orderBy: { name: "asc" } });
  return NextResponse.json({ enterprise: "Tech360 AI Workforce", totalDepartments: departments.length, totalAgents: departments.reduce((s, d) => s + d.agents.length, 0), departments });
}
