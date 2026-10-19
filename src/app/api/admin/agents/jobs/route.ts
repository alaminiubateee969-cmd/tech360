import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 32).toUpperCase()
  const agentCode = sanitizeText(url.searchParams.get('agentCode') ?? '', 20).toUpperCase()
  const clientId = sanitizeText(url.searchParams.get('clientId') ?? '', 64)
  const limit = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get('limit') ?? 50) || 50)))
  const allowedStatuses = ['QUEUED', 'RUNNING', 'RETRYING', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED']
  if (status && !allowedStatuses.includes(status)) return Response.json({ error: 'Invalid job status filter.' }, { status: 400 })

  const jobs = await db.agentJob.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(agentCode ? { agentCode } : {}),
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      agentCode: true,
      correlationId: true,
      clientId: true,
      projectId: true,
      workflow: true,
      taskType: true,
      toolName: true,
      status: true,
      approvalState: true,
      requestedBy: true,
      approvedBy: true,
      attempts: true,
      maxAttempts: true,
      availableAt: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      lastError: true,
      input: true,
      output: true,
      client: { select: { clientId: true, name: true } },
      project: { select: { code: true, name: true } },
      agent: { select: { name: true } },
    },
  })

  return Response.json({ jobs: jobs.map((job) => ({
    ...job,
    input: job.input.slice(0, 1000),
    output: job.output?.slice(0, 2000) ?? null,
    lastError: job.lastError?.slice(0, 1000) ?? null,
  })) })
}
