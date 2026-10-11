import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const { id } = await params
  const jobId = sanitizeText(id, 64)
  const job = await db.agentJob.findUnique({
    where: { id: jobId },
    include: {
      agent: { select: { code: true, name: true } },
      client: { select: { id: true, clientId: true, name: true } },
      project: { select: { id: true, code: true, name: true } },
    },
  })
  if (!job) return Response.json({ error: 'Agent job not found.' }, { status: 404 })
  return Response.json({ job })
}
