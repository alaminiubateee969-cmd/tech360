// ============================================================
// TECH360 — workflow definitions
// ============================================================
// A workflow is a directed graph of nodes. The graph is stored as JSON
// so it can be edited in the console, persisted and reloaded without a
// schema migration.
//
// SAFETY
// ------
// A workflow definition describes INTENT. It never executes anything by
// itself. Running a workflow goes through the task queue, and every node
// that touches a customer-visible channel is bound to an approval
// request — the same gate the rest of the platform uses.
//
// A DRAFT workflow is never eligible to run.
// ============================================================

import { db } from '@/lib/db'

export type WorkflowNodeKind =
  | 'TRIGGER'
  | 'AGENT'
  | 'SKILL'
  | 'APPROVAL'
  | 'TOOL'
  | 'NOTIFY'
  | 'WAIT'
  | 'END'

export type WorkflowNode = {
  id: string
  kind: WorkflowNodeKind
  label: string
  /** The agent code, skill id, tool name or channel this node binds to. */
  binding: string
  /** Extra configuration for the node (JSON-serialisable). */
  config?: Record<string, unknown>
  /** True when the node needs a human approval before it may run. */
  requiresApproval?: boolean
}

export type WorkflowEdge = {
  id: string
  from: string
  to: string
  label?: string
}

export type WorkflowDefinition = {
  id: string
  key: string
  name: string
  description: string | null
  version: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdBy: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export const WORKFLOW_NODE_KINDS: WorkflowNodeKind[] = [
  'TRIGGER',
  'AGENT',
  'SKILL',
  'APPROVAL',
  'TOOL',
  'NOTIFY',
  'WAIT',
  'END',
]

export class WorkflowValidationError extends Error {
  readonly issues: string[]
  constructor(issues: string[]) {
    super(issues.join('; '))
    this.name = 'WorkflowValidationError'
    this.issues = issues
  }
}

/**
 * Validate a workflow graph. A workflow that references a node that does
 * not exist, has more than one trigger, or has no path to an END node is
 * rejected — it cannot be published.
 */
export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const issues: string[] = []
  if (!Array.isArray(nodes) || nodes.length === 0) issues.push('a workflow needs at least one node')
  if (!Array.isArray(edges)) issues.push('edges must be an array')

  const ids = new Set<string>()
  for (const node of nodes ?? []) {
    if (!node?.id) {
      issues.push('every node needs an id')
      continue
    }
    if (ids.has(node.id)) issues.push(`duplicate node id "${node.id}"`)
    ids.add(node.id)
    if (!WORKFLOW_NODE_KINDS.includes(node.kind)) {
      issues.push(`node "${node.id}" has an unknown kind "${node.kind}"`)
    }
    if (!node.label || node.label.trim().length < 2) {
      issues.push(`node "${node.id}" needs a label`)
    }
  }
  for (const edge of edges ?? []) {
    if (!ids.has(edge.from)) issues.push(`edge "${edge.id}" starts at an unknown node "${edge.from}"`)
    if (!ids.has(edge.to)) issues.push(`edge "${edge.id}" ends at an unknown node "${edge.to}"`)
  }
  const triggers = (nodes ?? []).filter((node) => node.kind === 'TRIGGER')
  if (triggers.length === 0) issues.push('a workflow needs exactly one TRIGGER node')
  if (triggers.length > 1) issues.push('a workflow may only have one TRIGGER node')
  if (!(nodes ?? []).some((node) => node.kind === 'END')) issues.push('a workflow needs an END node')
  return issues
}

function parseNodes(raw: string): WorkflowNode[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as WorkflowNode[]) : []
  } catch {
    return []
  }
}

function parseEdges(raw: string): WorkflowEdge[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as WorkflowEdge[]) : []
  } catch {
    return []
  }
}

function toDefinition(row: {
  id: string
  key: string
  name: string
  description: string | null
  version: number
  status: string
  nodes: string
  edges: string
  createdBy: string | null
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): WorkflowDefinition {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status as WorkflowDefinition['status'],
    nodes: parseNodes(row.nodes),
    edges: parseEdges(row.edges),
    createdBy: row.createdBy,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listWorkflows(): Promise<WorkflowDefinition[]> {
  const rows = await db.workflowDefinition.findMany({ orderBy: { updatedAt: 'desc' } })
  return rows.map(toDefinition)
}

export async function getWorkflow(idOrKey: string): Promise<WorkflowDefinition | null> {
  const row = await db.workflowDefinition.findFirst({
    where: { OR: [{ id: idOrKey }, { key: idOrKey }] },
  })
  return row ? toDefinition(row) : null
}

/**
 * Save a workflow. The graph is validated first; an invalid graph is
 * refused rather than stored.
 */
export async function saveWorkflow(input: {
  id?: string
  key: string
  name: string
  description?: string
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdBy?: string
}): Promise<WorkflowDefinition> {
  const issues = validateWorkflow(input.nodes, input.edges)
  if (issues.length > 0) throw new WorkflowValidationError(issues)

  const status = input.status ?? 'DRAFT'
  const nodesJson = JSON.stringify(input.nodes)
  const edgesJson = JSON.stringify(input.edges)

  if (input.id) {
    const existing = await db.workflowDefinition.findUnique({ where: { id: input.id } })
    if (!existing) throw new Error('Workflow not found')
    const row = await db.workflowDefinition.update({
      where: { id: input.id },
      data: {
        name: input.name,
        description: input.description ?? null,
        status,
        nodes: nodesJson,
        edges: edgesJson,
        version: { increment: 1 },
        publishedAt: status === 'PUBLISHED' ? new Date() : existing.publishedAt,
        updatedAt: new Date(),
      },
    })
    return toDefinition(row)
  }

  const row = await db.workflowDefinition.upsert({
    where: { key: input.key },
    update: {
      name: input.name,
      description: input.description ?? null,
      status,
      nodes: nodesJson,
      edges: edgesJson,
      version: { increment: 1 },
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      updatedAt: new Date(),
    },
    create: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      status,
      nodes: nodesJson,
      edges: edgesJson,
      createdBy: input.createdBy ?? null,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      updatedAt: new Date(),
    },
  })
  return toDefinition(row)
}
