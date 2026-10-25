<<<<<<< HEAD
import { NextRequest } from 'next/server'
import { GET as adminAgents } from '@/app/api/admin/agents/route'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agents
 *
 * The public contract path for the agent registry. It delegates to the
 * EXISTING admin registry route so there is exactly one implementation
 * of the agent listing and one RBAC policy — no duplicated route.
 */
export async function GET(req: NextRequest) {
  return adminAgents(req)
=======
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await db.agent.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { runs: true } } },
  });
  return NextResponse.json({ agents });
>>>>>>> upload/tech360-production-final
}
