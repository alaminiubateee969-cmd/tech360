// ============================================================
// TECH360 — unified memory system
// ============================================================
// One memory system with FOUR TYPES and ENTERPRISE SCOPES.
//
// TYPES
//   WORKING    — the scratchpad of the current task. Short-lived.
//   EPISODIC   — "what happened": a record of a run and its result.
//   SEMANTIC   — "what is true": facts that hold now.
//   PROCEDURAL — "how we do it": the steps, carried by a lesson.
//
// SCOPES
//   The existing `AiMemory.scope` values (COMPANY, CLIENT, PROJECT,
//   WORKFLOW, LESSON, …) plus the enterprise scopes: DEPARTMENT,
//   SHARED, STRATEGIC, OPERATIONAL, SENSITIVE.
//
// THE RULES THAT MATTER
//   1. NEVER inject all memory. Retrieval returns only the relevant
//      slice, capped by the caller.
//   2. Permission-aware. A memory whose access level the caller does
//      not hold is invisible, and the filter is applied in the
//      application as well as in the query.
//   3. Validated. A memory that has not been validated is marked as
//      such; it can be retrieved, but it cannot be presented as
//      established fact.
//   4. Versioned and auditable. A write bumps the version and records
//      who wrote it, when, and from which run.
//   5. Expiring. A memory with an expiry is not returned after it.
//
// The existing `rememberMemory` / `recallMemory` in
// `src/lib/agents/engine.ts` are LEFT ALONE. This module is the
// richer, permission-aware API; the older functions remain the
// simple engine-level path and are still in use.
// ============================================================

import { db } from '@/lib/db'
import { newCorrelationId } from '@/lib/correlation'
import { audit } from '@/lib/security'
import { ACCESS_LEVELS, type AccessLevel } from '@/lib/rag/store'

export const MEMORY_TYPES = ['WORKING', 'EPISODIC', 'SEMANTIC', 'PROCEDURAL'] as const
export type MemoryType = (typeof MEMORY_TYPES)[number]

export const ENTERPRISE_SCOPES = [
  'DEPARTMENT',
  'SHARED',
  'STRATEGIC',
  'OPERATIONAL',
  'SENSITIVE',
  'COMPANY',
  'BRAND',
  'SERVICES',
  'PRICING',
  'POLICIES',
  'CLIENT',
  'PROJECT',
  'COMMUNICATION',
  'WORKFLOW',
  'KNOWLEDGE',
  'AGENT',
  'TASK',
  'LESSON',
] as const
export type MemoryScope = (typeof ENTERPRISE_SCOPES)[number]

export type MemoryEntry = {
  id: string
  scope: string
  key: string
  content: string
  memoryType: MemoryType
  accessLevel: AccessLevel
  departmentCode: string | null
  version: number
  validated: boolean
  source: string
  importance: number
  hits: number
  agentCode: string | null
  clientId: string | null
  projectId: string | null
  expiresAt: Date | null
  correlationId: string | null
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export type WriteMemoryInput = {
  scope: MemoryScope
  key: string
  content: string
  memoryType: MemoryType
  accessLevel?: AccessLevel
  departmentCode?: string | null
  agentCode?: string | null
  clientId?: string | null
  projectId?: string | null
  importance?: number
  validated?: boolean
  source?: string
  expiresAt?: Date | null
  correlationId?: string
  tags?: string[]
  writtenBy?: string
}

/** The maximum number of memories a single retrieval may return. */
export const MEMORY_RETRIEVAL_CAP = 25

// ------------------------------------------------------------
// Writing
// ------------------------------------------------------------

/**
 * Write a memory.
 *
 * A write is validated first: a memory with no key, no content or an
 * unknown type is refused. A refusal is not a silent no-op.
 */
export async function writeMemory(input: WriteMemoryInput): Promise<MemoryEntry> {
  const problems = validateWrite(input)
  if (problems.length > 0) {
    throw new Error(`MEMORY_WRITE_REJECTED: ${problems.join('; ')}`)
  }

  const correlationId = input.correlationId ?? newCorrelationId()
  const accessLevel = input.accessLevel ?? defaultAccessFor(input.scope)

  const existing = await db.aiMemory.findFirst({
    where: {
      scope: input.scope,
      key: input.key,
      clientId: input.clientId ?? null,
    },
  })

  const row = existing
    ? await db.aiMemory.update({
        where: { id: existing.id },
        data: {
          content: input.content,
          memoryType: input.memoryType,
          accessLevel,
          departmentCode: input.departmentCode ?? existing.departmentCode,
          version: { increment: 1 },
          validated: input.validated ?? existing.validated,
          source: input.source ?? existing.source,
          importance: input.importance ?? existing.importance,
          expiresAt: input.expiresAt === undefined ? existing.expiresAt : input.expiresAt,
          correlationId,
          tags: input.tags ? JSON.stringify(input.tags) : existing.tags,
          updatedAt: new Date(),
        },
      })
    : await db.aiMemory.create({
        data: {
          scope: input.scope,
          key: input.key,
          content: input.content,
          memoryType: input.memoryType,
          accessLevel,
          departmentCode: input.departmentCode ?? null,
          clientId: input.clientId ?? null,
          projectId: input.projectId ?? null,
          agentCode: input.agentCode ?? null,
          importance: input.importance ?? defaultImportance(input.memoryType),
          validated: input.validated ?? false,
          source: input.source ?? 'AGENT',
          expiresAt: input.expiresAt ?? null,
          correlationId,
          tags: input.tags ? JSON.stringify(input.tags) : null,
        },
      })

  await audit({
    actor: input.writtenBy ? `agent:${input.writtenBy}` : 'system:memory',
    action: existing ? 'MEMORY_UPDATED' : 'MEMORY_WRITTEN',
    entityType: 'AiMemory',
    entityId: row.id,
    details: {
      scope: input.scope,
      key: input.key,
      memoryType: input.memoryType,
      accessLevel,
      version: existing ? existing.version + 1 : 1,
      validated: input.validated ?? false,
      correlationId,
    },
  })

  return hydrate(row)
}

// ------------------------------------------------------------
// Reading
// ------------------------------------------------------------

export type RetrieveMemoryInput = {
  /** The scopes the caller may read. */
  scopes: MemoryScope[]
  /** The access levels the caller holds. */
  accessLevels: AccessLevel[]
  /** The types the caller wants. */
  memoryTypes?: MemoryType[]
  /** Free-text relevance terms. */
  query?: string
  /** The department whose memories the caller may read. */
  departmentCode?: string | null
  /** The client the caller may read. */
  clientId?: string | null
  agentCode?: string | null
  limit?: number
}

/**
 * Retrieve the relevant memory.
 *
 * The cap is hard: the caller can ask for fewer memories, never more
 * than `MEMORY_RETRIEVAL_CAP`. This is the mechanism that stops a
 * model context from being flooded with memory.
 */
export async function retrieveMemory(input: RetrieveMemoryInput): Promise<MemoryEntry[]> {
  const limit = Math.max(1, Math.min(MEMORY_RETRIEVAL_CAP, input.limit ?? 8))
  const allowedAccess = input.accessLevels.length > 0 ? input.accessLevels : (['PUBLIC'] as AccessLevel[])
  const allowedScopes = input.scopes.length > 0 ? input.scopes : (['COMPANY'] as MemoryScope[])
  const now = new Date()

  const rows = await db.aiMemory.findMany({
    where: {
      scope: { in: [...allowedScopes] },
      accessLevel: { in: allowedAccess },
      ...(input.memoryTypes?.length ? { memoryType: { in: input.memoryTypes } } : {}),
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ...(input.departmentCode ? [{ OR: [{ departmentCode: input.departmentCode }, { departmentCode: null }] }] : []),
        ...(input.clientId ? [{ OR: [{ clientId: input.clientId }, { clientId: null }] }] : []),
        ...(input.agentCode ? [{ OR: [{ agentCode: input.agentCode }, { agentCode: null }] }] : []),
        ...(input.query ? [{ OR: [{ key: { contains: input.query } }, { content: { contains: input.query } }] }] : []),
      ],
    },
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: limit * 3,
  })

  // The access filter is re-applied in the application so that a
  // change to the query can never widen what the caller sees.
  const visible = rows.filter((row) => allowedAccess.includes(row.accessLevel as AccessLevel))
  const ranked = visible
    .map((row) => ({ row, score: scoreMemory(row, input.query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  if (ranked.length > 0) {
    const ids = ranked.map((entry) => entry.row.id)
    await db.aiMemory
      .updateMany({ where: { id: { in: ids } }, data: { hits: { increment: 1 } } })
      .catch(() => undefined)
  }

  return ranked.map((entry) => hydrate(entry.row))
}

/**
 * Score a memory for a query.
 *
 * A key match beats a content match; a validated memory beats an
 * unvalidated one; a fresher memory beats a stale one. An unvalidated
 * memory is still returned, but it is marked.
 */
export function scoreMemory(row: { key: string; content: string; validated: boolean; importance: number; updatedAt: Date }, query?: string): number {
  let score = row.importance / 10
  if (row.validated) score += 0.2
  if (query) {
    const term = query.toLowerCase()
    if (row.key.toLowerCase().includes(term)) score += 0.5
    if (row.content.toLowerCase().includes(term)) score += 0.25
  }
  const ageDays = (Date.now() - row.updatedAt.getTime()) / 86_400_000
  score *= 1 / (1 + ageDays / 30)
  return Math.round(score * 10_000) / 10_000
}

// ------------------------------------------------------------
// Validation and promotion
// ------------------------------------------------------------

/**
 * Validate a memory: mark it as reviewed and confirmed.
 *
 * A memory is only promoted to `validated` by an explicit review. The
 * learning engine proposes; a human (or a validator in the quality
 * engine) confirms.
 */
export async function validateMemory(id: string, reviewedBy: string, accepted: boolean): Promise<MemoryEntry> {
  const row = await db.aiMemory.update({
    where: { id },
    data: {
      validated: accepted,
      version: { increment: 1 },
      correlationId: newCorrelationId(),
    },
  })
  await audit({
    actor: `user:${reviewedBy}`,
    action: accepted ? 'MEMORY_VALIDATED' : 'MEMORY_REJECTED',
    entityType: 'AiMemory',
    entityId: id,
    details: { scope: row.scope, key: row.key, memoryType: row.memoryType },
  })
  return hydrate(row)
}

/** Expire a memory. It stops being retrieved but is kept for audit. */
export async function expireMemory(id: string, reason: string): Promise<void> {
  await db.aiMemory.update({ where: { id }, data: { expiresAt: new Date(), version: { increment: 1 } } })
  await audit({
    actor: 'system:memory',
    action: 'MEMORY_EXPIRED',
    entityType: 'AiMemory',
    entityId: id,
    details: { reason },
  })
}

/** The memory a department holds, for the dashboard. */
export async function memoryStats(accessLevels: AccessLevel[]): Promise<{
  total: number
  byType: Record<string, number>
  byScope: Record<string, number>
  validated: number
  expiringSoon: number
}> {
  const allowed = accessLevels.length > 0 ? accessLevels : (['PUBLIC'] as AccessLevel[])
  const rows = await db.aiMemory.findMany({
    where: { accessLevel: { in: allowed } },
    select: { memoryType: true, scope: true, validated: true, expiresAt: true },
  })
  const byType: Record<string, number> = {}
  const byScope: Record<string, number> = {}
  let validated = 0
  let expiringSoon = 0
  const soon = Date.now() + 7 * 86_400_000
  for (const row of rows) {
    byType[row.memoryType] = (byType[row.memoryType] ?? 0) + 1
    byScope[row.scope] = (byScope[row.scope] ?? 0) + 1
    if (row.validated) validated += 1
    if (row.expiresAt && row.expiresAt.getTime() > Date.now() && row.expiresAt.getTime() < soon) expiringSoon += 1
  }
  return { total: rows.length, byType, byScope, validated, expiringSoon }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

export function validateWrite(input: WriteMemoryInput): string[] {
  const problems: string[] = []
  if (!input.key || input.key.trim().length === 0) problems.push('the key is empty')
  if (!input.content || input.content.trim().length === 0) problems.push('the content is empty')
  if (!MEMORY_TYPES.includes(input.memoryType)) problems.push(`"${input.memoryType}" is not a memory type`)
  if (input.accessLevel && !(ACCESS_LEVELS as readonly string[]).includes(input.accessLevel)) {
    problems.push(`"${input.accessLevel}" is not an access level`)
  }
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    problems.push('the expiry is already in the past')
  }
  return problems
}

/** The default access level for a scope. */
export function defaultAccessFor(scope: MemoryScope): AccessLevel {
  if (scope === 'SENSITIVE') return 'RESTRICTED'
  if (scope === 'STRATEGIC' || scope === 'POLICIES' || scope === 'PRICING') return 'CONFIDENTIAL'
  if (scope === 'CLIENT' || scope === 'PROJECT' || scope === 'COMMUNICATION') return 'CONFIDENTIAL'
  return 'INTERNAL'
}

/** The default importance for a memory type. */
export function defaultImportance(type: MemoryType): number {
  if (type === 'WORKING') return 2
  if (type === 'EPISODIC') return 4
  if (type === 'SEMANTIC') return 7
  return 8
}

function hydrate(row: {
  id: string
  scope: string
  key: string
  content: string
  memoryType: string
  accessLevel: string
  departmentCode: string | null
  version: number
  validated: boolean
  source: string
  importance: number
  hits: number
  agentCode: string | null
  clientId: string | null
  projectId: string | null
  expiresAt: Date | null
  correlationId: string | null
  tags: string | null
  createdAt: Date
  updatedAt: Date
}): MemoryEntry {
  return {
    id: row.id,
    scope: row.scope,
    key: row.key,
    content: row.content,
    memoryType: (MEMORY_TYPES as readonly string[]).includes(row.memoryType) ? (row.memoryType as MemoryType) : 'SEMANTIC',
    accessLevel: (ACCESS_LEVELS as readonly string[]).includes(row.accessLevel) ? (row.accessLevel as AccessLevel) : 'INTERNAL',
    departmentCode: row.departmentCode,
    version: row.version,
    validated: row.validated,
    source: row.source,
    importance: row.importance,
    hits: row.hits,
    agentCode: row.agentCode,
    clientId: row.clientId,
    projectId: row.projectId,
    expiresAt: row.expiresAt,
    correlationId: row.correlationId,
    tags: parseTags(row.tags),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function parseTags(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
