import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tasks/{id}
 *
 * The state of one durable task, including its approval state, attempt
 * count, lease information and (truncated) output. The same row backs
 * both LLM inference jobs and skill executions.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const { id } = await params
  const taskId = sanitizeText(id, 64)
  if (!taskId) {
    return Response.json({ error: 'A task id is required.', code: 'INVALID_REQUEST' }, { status: 400 })
  }

  const task = await db.agentJob.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      taskType: true,
      agentCode: true,
      status: true,
      approvalState: true,
      attempts: true,
      maxAttempts: true,
      correlationId: true,
      workflow: true,
      requestedBy: true,
      approvedBy: true,
      approvedAt: true,
      approvalNote: true,
      lastError: true,
      input: true,
      output: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      availableAt: true,
      leaseUntil: true,
      claimedBy: true,
    },
  })
  if (!task) return Response.json({ error: 'Task not found.', code: 'UNKNOWN_TASK' }, { status: 404 })

  return Response.json({
    task: {
      ...task,
      input: task.input.slice(0, 2000),
      output: task.output?.slice(0, 4000) ?? null,
      lastError: task.lastError?.slice(0, 1000) ?? null,
    },
  })
}
