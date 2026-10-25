<<<<<<< HEAD
import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText } from '@/lib/security'
import { db } from '@/lib/db'
import { enqueueSkillTask } from '@/lib/skills/queue'
import { getSkillDefinition } from '@/lib/skills/registry'
import { enqueueAgentJob } from '@/lib/agents/jobs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/tasks
 *
 * Queues a durable task. The task is stored on the SAME AgentJob queue
 * the agent runtime already uses, so there is one task store with one
 * lease, retry and crash-recovery implementation.
 *
 * Body:
 *   { "type": "SKILL", "skillId": "…", "payload": { … } }
 *   { "type": "AGENT", "agentCode": "CRM-014", "input": "…", "expectJson": true }
 *
 * An `Idempotency-Key` header is REQUIRED. Replaying the same key with
 * the same body returns the original task; replaying it with a
 * DIFFERENT body is rejected with 409.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE, limit: { max: 60, windowMs: 60_000 } })
  if (isResponse(g)) return g

  const idempotencyKey = sanitizeText(req.headers.get('idempotency-key') ?? '', 191)
  if (!idempotencyKey) {
    return Response.json(
      { error: 'An Idempotency-Key header is required to create a task.', code: 'IDEMPOTENCY_KEY_REQUIRED' },
      { status: 400 },
    )
  }

  const raw = await readJson(req)
  const type = sanitizeText(raw.type ?? 'AGENT', 20).toUpperCase()

  if (type === 'SKILL') {
    const skillId = sanitizeText(raw.skillId ?? '', 120)
    if (!skillId) return Response.json({ error: 'skillId is required.', code: 'INVALID_REQUEST' }, { status: 400 })
    const definition = getSkillDefinition(skillId)
    if (!definition) {
      return Response.json({ error: `Skill "${skillId}" is not in the registry.`, code: 'UNKNOWN_SKILL' }, { status: 404 })
    }
    if (definition.status !== 'ACTIVE') {
      return Response.json({ error: `Skill "${skillId}" is ${definition.status}.`, code: 'SKILL_NOT_ACTIVE' }, { status: 409 })
    }
    const payload = (raw.payload ?? {}) as Record<string, unknown>
    const granted = Array.isArray(raw.grantedPermissions)
      ? (raw.grantedPermissions as string[]).map((p) => sanitizeText(p, 120)).filter(Boolean)
      : definition.permissions

    try {
      const { job, created } = await enqueueSkillTask({
        skillId,
        payload,
        idempotencyKey,
        grantedPermissions: granted,
        requestedBy: g.user.email,
      })
      return Response.json(
        {
          task: {
            id: job.id,
            type: 'SKILL',
            skillId,
            status: job.status,
            approvalState: job.approvalState,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            correlationId: job.correlationId,
            createdAt: job.createdAt,
            availableAt: job.availableAt,
          },
          created,
        },
        { status: created ? 201 : 200 },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not queue the task'
      const conflict = /idempotency/i.test(message)
      return Response.json(
        { error: message, code: conflict ? 'IDEMPOTENCY_CONFLICT' : 'TASK_ENQUEUE_FAILED' },
        { status: conflict ? 409 : 400 },
      )
    }
  }

  if (type === 'AGENT') {
    const agentCode = sanitizeText(raw.agentCode ?? '', 20).toUpperCase()
    if (!agentCode) return Response.json({ error: 'agentCode is required.', code: 'INVALID_REQUEST' }, { status: 400 })
    const input = typeof raw.input === 'string' ? raw.input.trim() : ''
    if (!input) return Response.json({ error: 'input is required.', code: 'INVALID_REQUEST' }, { status: 400 })
    try {
      const { job, created } = await enqueueAgentJob({
        agentCode,
        idempotencyKey,
        input,
        expectJson: raw.expectJson === true,
        contextNote: sanitizeText(raw.contextNote ?? '', 4000) || undefined,
        workflow: sanitizeText(raw.workflow ?? 'API_TASK', 191) || 'API_TASK',
        requestedBy: g.user.email,
      })
      return Response.json(
        {
          task: {
            id: job.id,
            type: 'INFERENCE',
            agentCode: job.agentCode,
            status: job.status,
            approvalState: job.approvalState,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            correlationId: job.correlationId,
            createdAt: job.createdAt,
            availableAt: job.availableAt,
          },
          created,
        },
        { status: created ? 201 : 200 },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not queue the task'
      const conflict = /idempotency/i.test(message)
      return Response.json(
        { error: message, code: conflict ? 'IDEMPOTENCY_CONFLICT' : 'TASK_ENQUEUE_FAILED' },
        { status: conflict ? 409 : 400 },
      )
    }
  }

  return Response.json(
    { error: `Unsupported task type "${type}". Use SKILL or AGENT.`, code: 'INVALID_REQUEST' },
    { status: 400 },
  )
}

/**
 * GET /api/tasks
 *
 * Lists queued tasks (the same AgentJob store the worker pool reads).
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 32).toUpperCase()
  const taskType = sanitizeText(url.searchParams.get('type') ?? '', 20).toUpperCase()
  const limit = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get('limit') ?? 50) || 50)))
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset') ?? 0) || 0))

  const where = {
    ...(status ? { status } : {}),
    ...(taskType ? { taskType } : {}),
  }
  const [tasks, total] = await Promise.all([
    db.agentJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
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
        lastError: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        availableAt: true,
      },
    }),
    db.agentJob.count({ where }),
  ])

  return Response.json({ total, limit, offset, tasks })
=======
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT","STAFF"], req);
  if (!auth.ok) return auth.response;
  const items = await db.task.findMany({ take: 100, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ tasks: items });
}
export async function POST(req: NextRequest) {
  const auth = await requireRole(["SUPER_ADMIN","MANAGER","AGENT"], req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const item = await db.task.create({ data: body });
  return NextResponse.json({ tasks: item }, { status: 201 });
>>>>>>> upload/tech360-production-final
}
