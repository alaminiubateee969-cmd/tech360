import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { listWorkflows, saveWorkflow, WorkflowValidationError } from '@/lib/workflows/definitions'
import type { WorkflowEdge, WorkflowNode } from '@/lib/workflows/definitions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/workflows — the persisted workflow diagrams.
 * POST /api/admin/workflows — create or update one.
 *
 * The diagram is validated on write: an invalid graph is refused, and a
 * DRAFT workflow can never be executed.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const workflows = await listWorkflows()
  return Response.json({ workflows, total: workflows.length })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const raw = await readJson(req)

  const key = sanitizeText(raw.key ?? '', 60)
  const name = sanitizeText(raw.name ?? '', 120)
  if (!key) return Response.json({ error: 'key is required.', code: 'INVALID_REQUEST' }, { status: 400 })
  if (!name) return Response.json({ error: 'name is required.', code: 'INVALID_REQUEST' }, { status: 400 })

  const statusRaw = sanitizeText(raw.status ?? 'DRAFT', 20).toUpperCase()
  const status = (['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).includes(statusRaw as 'DRAFT')
    ? (statusRaw as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED')
    : 'DRAFT'

  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []) as WorkflowNode[]
  const edges = (Array.isArray(raw.edges) ? raw.edges : []) as WorkflowEdge[]

  try {
    const workflow = await saveWorkflow({
      id: raw.id ? sanitizeText(raw.id, 64) : undefined,
      key,
      name,
      description: sanitizeText(raw.description ?? '', 500) || undefined,
      status,
      nodes,
      edges,
      createdBy: g.user.email,
    })
    await audit({
      actor: g.user.email,
      action: 'WORKFLOW_SAVED',
      userId: g.user.id,
      entityType: 'WorkflowDefinition',
      entityId: workflow.id,
      details: { key, status: workflow.status, version: workflow.version, nodes: nodes.length, edges: edges.length },
    })
    return Response.json({ workflow }, { status: 200 })
  } catch (error) {
    if (error instanceof WorkflowValidationError) {
      return Response.json(
        { error: 'The workflow diagram is not valid.', code: 'INVALID_WORKFLOW', issues: error.issues },
        { status: 422 },
      )
    }
    const message = error instanceof Error ? error.message : 'Could not save the workflow'
    return Response.json({ error: message, code: 'WORKFLOW_SAVE_FAILED' }, { status: 400 })
  }
}
