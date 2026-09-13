import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Update a project task: status transitions + evidence notes (real DB writes)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const { id, taskId } = await params
  const project = await db.project.findFirst({ where: { OR: [{ id: sanitizeText(id, 40) }, { code: sanitizeText(id, 40) }] } })
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 })
  const task = await db.projectTask.findFirst({ where: { id: sanitizeText(taskId, 40), projectId: project.id } })
  if (!task) return Response.json({ error: 'Task not found' }, { status: 404 })

  const raw = await readJson(req)
  const status = sanitizeText(raw.status, 20).toUpperCase()
  const evidence = sanitizeText(raw.evidence, 4000)
  const description = sanitizeText(raw.description, 2000)
  const priority = sanitizeText(raw.priority, 10).toUpperCase()

  const data: Record<string, unknown> = {}
  if (status && ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED'].includes(status)) {
    data.status = status
    data.completedAt = status === 'DONE' ? new Date() : null
  }
  if (evidence) {
    const existing = task.evidence ? (JSON.parse(task.evidence) as unknown[]) : []
    existing.push({ note: evidence, by: g.user.email, at: new Date().toISOString() })
    data.evidence = JSON.stringify(existing).slice(0, 8000)
  }
  if (description) data.description = description
  if (priority && ['LOW', 'MEDIUM', 'HIGH'].includes(priority)) data.priority = priority
  if (Object.keys(data).length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 })

  const updated = await db.projectTask.update({ where: { id: task.id }, data })
  await audit({ actor: g.user.email, action: 'TASK_UPDATED', userId: g.user.id, projectId: project.id, entityId: task.id, details: { status: updated.status } })
  return Response.json({ ok: true, task: updated, message: `Task "${task.title}" → ${updated.status}` })
}
