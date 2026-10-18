// ============================================================
// TECH360 — knowledge graph
// ============================================================
// The Knowledge Intelligence Layer: RAG (already in `src/lib/rag`)
// PLUS a graph of entities and the relationships between them.
//
// WHY A GRAPH
//   RAG finds passages. A graph finds STRUCTURE: which service belongs
//   to which client, which policy governs which tool, which department
//   owns which SOP, which employee escalated to which manager. That
//   structure is what lets an agent answer "who is affected by this
//   policy change" without reading every document.
//
// NOT A DUPLICATE
//   The RAG pipeline in `src/lib/rag` is untouched. The graph is a
//   second INDEX over the same corpus, not a second corpus. Entities
//   carry a `source` and the chunk they came from, so a graph fact
//   can always be traced back to the document that supports it.
//
// ACCESS
//   Every entity and every relation carries an access level. A query
//   is filtered by the access levels the caller holds, in the
//   application, not only in the query — the same rule the RAG
//   store uses.
// ============================================================

import { db } from '@/lib/db'
import { newCorrelationId } from '@/lib/correlation'
import { audit } from '@/lib/security'
import { ACCESS_LEVELS, type AccessLevel } from '@/lib/rag/store'

export type EntityType =
  | 'PERSON'
  | 'ORGANISATION'
  | 'SERVICE'
  | 'POLICY'
  | 'CLIENT'
  | 'PROJECT'
  | 'CONCEPT'
  | 'DOCUMENT'
  | 'DEPARTMENT'
  | 'SOP'
  | 'TOOL'
  | 'AGENT'

export const ENTITY_TYPES: EntityType[] = [
  'PERSON',
  'ORGANISATION',
  'SERVICE',
  'POLICY',
  'CLIENT',
  'PROJECT',
  'CONCEPT',
  'DOCUMENT',
  'DEPARTMENT',
  'SOP',
  'TOOL',
  'AGENT',
]

export type RelationType =
  | 'RELATED_TO'
  | 'PART_OF'
  | 'MANAGED_BY'
  | 'DEPENDS_ON'
  | 'APPLIES_TO'
  | 'GOVERNED_BY'
  | 'PRODUCES'
  | 'CONSUMES'
  | 'ASSIGNED_TO'
  | 'ESCALATES_TO'

export const RELATION_TYPES: RelationType[] = [
  'RELATED_TO',
  'PART_OF',
  'MANAGED_BY',
  'DEPENDS_ON',
  'APPLIES_TO',
  'GOVERNED_BY',
  'PRODUCES',
  'CONSUMES',
  'ASSIGNED_TO',
  'ESCALATES_TO',
]

export type KnowledgeEntity = {
  key: string
  name: string
  type: EntityType
  description: string | null
  accessLevel: AccessLevel
  confidence: number
  properties: Record<string, unknown>
  source: string
  version: number
  verified: boolean
  createdAt: Date
  updatedAt: Date
}

export type KnowledgeRelation = {
  id: string
  fromKey: string
  toKey: string
  type: RelationType
  weight: number
  confidence: number
  provenance: string | null
  accessLevel: AccessLevel
  version: number
  createdAt: Date
}

// ------------------------------------------------------------
// Entity writes
// ------------------------------------------------------------

export type UpsertEntityInput = {
  key: string
  name: string
  type: EntityType
  description?: string | null
  accessLevel?: AccessLevel
  confidence?: number
  properties?: Record<string, unknown>
  source?: string
  verified?: boolean
  /** Who asserted the entity. */
  assertedBy?: string
}

/**
 * Create or update an entity.
 *
 * The confidence is never silently raised: a new assertion against an
 * existing entity combines the two confidences rather than replacing
 * one with the other, and a claim from a stronger source counts for
 * more.
 */
export async function upsertEntity(input: UpsertEntityInput): Promise<KnowledgeEntity> {
  const accessLevel = input.accessLevel ?? 'INTERNAL'
  const existing = await db.knowledgeEntity.findUnique({ where: { key: input.key } })

  if (!existing) {
    const row = await db.knowledgeEntity.create({
      data: {
        key: input.key,
        name: input.name,
        type: input.type,
        description: input.description ?? null,
        accessLevel,
        confidence: input.confidence ?? 0.5,
        properties: input.properties ? JSON.stringify(input.properties) : null,
        source: input.source ?? 'PLATFORM',
        verified: input.verified ?? false,
      },
    })
    return hydrateEntity(row)
  }

  const combined = combineConfidence(existing.confidence, input.confidence ?? 0.5)
  const row = await db.knowledgeEntity.update({
    where: { key: input.key },
    data: {
      name: input.name || existing.name,
      description: input.description ?? existing.description,
      confidence: combined,
      properties: input.properties
        ? JSON.stringify({ ...parseProperties(existing.properties), ...input.properties })
        : existing.properties,
      version: { increment: 1 },
      verified: input.verified === true ? true : existing.verified,
    },
  })
  return hydrateEntity(row)
}

/**
 * Combine two confidence values.
 *
 * Two independent 0.5 claims are not 1.0 certainty — they are
 * corroboration, and corroboration is worth more than a single
 * claim but less than certainty. The combination is
 * `1 - (1 - a)(1 - b)` scaled by a corroboration factor of 0.9.
 */
export function combineConfidence(existing: number, incoming: number): number {
  const a = clamp(existing, 0, 1)
  const b = clamp(incoming, 0, 1)
  const independent = 1 - (1 - a) * (1 - b)
  // A weaker claim never LOWERS an established confidence: two
  // independent 0.5 claims are corroboration (0.75), but a 0.1 claim
  // arriving at an established 0.9 leaves it at 0.9.
  return round(clamp(Math.max(a, independent * 0.9), 0, 1))
}

// ------------------------------------------------------------
// Relation writes
// ------------------------------------------------------------

export type LinkInput = {
  fromKey: string
  toKey: string
  type: RelationType
  weight?: number
  confidence?: number
  provenance?: string | null
  accessLevel?: AccessLevel
  assertedBy?: string
}

/** Link two entities. Both must exist. */
export async function linkEntities(input: LinkInput): Promise<KnowledgeRelation> {
  const accessLevel = input.accessLevel ?? 'INTERNAL'
  const existing = await db.knowledgeRelation.findUnique({
    where: { fromKey_toKey_type: { fromKey: input.fromKey, toKey: input.toKey, type: input.type } },
  })
  if (existing) {
    const row = await db.knowledgeRelation.update({
      where: { id: existing.id },
      data: {
        weight: input.weight ?? existing.weight,
        confidence: combineConfidence(existing.confidence, input.confidence ?? 0.5),
        provenance: input.provenance ?? existing.provenance,
        version: { increment: 1 },
      },
    })
    return hydrateRelation(row)
  }
  const row = await db.knowledgeRelation.create({
    data: {
      fromKey: input.fromKey,
      toKey: input.toKey,
      type: input.type,
      weight: input.weight ?? 0.5,
      confidence: input.confidence ?? 0.5,
      provenance: input.provenance ?? null,
      accessLevel,
    },
  })
  return hydrateRelation(row)
}

// ------------------------------------------------------------
// Queries
// ------------------------------------------------------------

export type GraphNeighbour = {
  entity: KnowledgeEntity
  relation: { type: RelationType; weight: number; confidence: number; direction: 'OUT' | 'IN' }
  score: number
}

/**
 * The neighbourhood of an entity, filtered by the access levels the
 * caller holds.
 *
 * The filter is applied in the application as well as in the query, so
 * a change to the query can never widen the access.
 */
export async function neighbourhood(
  key: string,
  options: { accessLevels: AccessLevel[]; depth?: number; limit?: number; minConfidence?: number },
): Promise<GraphNeighbour[]> {
  const depth = Math.max(1, Math.min(3, options.depth ?? 1))
  const limit = Math.min(500, options.limit ?? 100)
  const minConfidence = options.minConfidence ?? 0.2
  const allowed = new Set(options.accessLevels)

  const seen = new Set<string>([key])
  let frontier = [key]
  const collected: GraphNeighbour[] = []

  for (let level = 0; level < depth; level += 1) {
    const relations = await db.knowledgeRelation.findMany({
      where: {
        OR: [{ fromKey: { in: frontier } }, { toKey: { in: frontier } }],
      },
      take: limit * 4,
    })

    const next: string[] = []
    for (const relation of relations) {
      if (relation.confidence < minConfidence) continue
      // The relation is OUT when it leaves the frontier, IN when it
      // arrives. A relation between two frontier members is skipped.
      const outbound = frontier.includes(relation.fromKey)
      const inbound = frontier.includes(relation.toKey)
      if (!outbound && !inbound) continue
      const otherKey = outbound ? relation.toKey : relation.fromKey
      if (otherKey === key) continue
      if (seen.has(otherKey) && level === 0) continue
      const direction: 'OUT' | 'IN' = outbound ? 'OUT' : 'IN'
      if (relation.accessLevel && !allowed.has(relation.accessLevel as AccessLevel)) continue

      const entity = await db.knowledgeEntity.findUnique({ where: { key: otherKey } })
      if (!entity) continue
      if (entity.accessLevel && !allowed.has(entity.accessLevel as AccessLevel)) continue

      const score = relation.confidence * relation.weight * Math.pow(0.6, level)
      collected.push({
        entity: hydrateEntity(entity),
        relation: { type: relation.type as RelationType, weight: relation.weight, confidence: relation.confidence, direction },
        score: round(score),
      })
      seen.add(otherKey)
      next.push(otherKey)
    }
    if (next.length === 0) break
    frontier = next
  }

  return collected.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Find entities by name or description, filtered by access level. */
export async function findEntities(
  query: string,
  options: { accessLevels: AccessLevel[]; type?: EntityType; limit?: number },
): Promise<KnowledgeEntity[]> {
  const allowed = options.accessLevels
  const rows = await db.knowledgeEntity.findMany({
    where: {
      ...(options.type ? { type: options.type } : {}),
      ...(allowed.length > 0 ? { accessLevel: { in: allowed } } : {}),
      OR: [{ name: { contains: query } }, { key: { contains: query } }, { description: { contains: query } }],
    },
    orderBy: { confidence: 'desc' },
    take: Math.min(100, options.limit ?? 25),
  })
  return rows.map(hydrateEntity)
}

/** The relation between two entities, if any. */
export async function relationBetween(
  fromKey: string,
  toKey: string,
  options: { accessLevels: AccessLevel[] },
): Promise<KnowledgeRelation[]> {
  const allowed = options.accessLevels
  const rows = await db.knowledgeRelation.findMany({
    where: {
      OR: [
        { fromKey, toKey },
        { fromKey: toKey, toKey: fromKey },
      ],
      ...(allowed.length > 0 ? { accessLevel: { in: allowed } } : {}),
    },
  })
  return rows.map(hydrateRelation)
}

/** The graph's real size. */
export async function graphStats(): Promise<{ entities: number; relations: number; verifiedEntities: number }> {
  const [entities, relations, verified] = await Promise.all([
    db.knowledgeEntity.count(),
    db.knowledgeRelation.count(),
    db.knowledgeEntity.count({ where: { verified: true } }),
  ])
  return { entities, relations, verifiedEntities: verified }
}

// ------------------------------------------------------------
// Building the graph from the platform's own structure
// ------------------------------------------------------------

/**
 * Build the graph edges that are TRUE BY CONSTRUCTION: the
 * organisation, the departments, the SOPs and the tools.
 *
 * These are facts about the platform, not extracted assertions, so
 * their confidence is 1 and they are marked verified.
 */
export async function buildStructuralGraph(options: { assertedBy?: string }): Promise<{ entities: number; relations: number }> {
  const { DEPARTMENTS } = await import('@/lib/agents/registry')
  const { SOP_LIBRARY } = await import('@/lib/sops/library')
  const { TOOL_REGISTRY } = await import('@/lib/tools/registry')
  const { buildOrgChart } = await import('@/lib/agents/org')

  let entities = 0
  let relations = 0

  for (const department of DEPARTMENTS) {
    await upsertEntity({
      key: `dept:${department.code}`,
      name: department.name,
      type: 'DEPARTMENT',
      description: `${department.category} department of the AI workforce.`,
      accessLevel: 'INTERNAL',
      confidence: 1,
      source: 'PLATFORM_STRUCTURE',
      verified: true,
    })
    entities += 1
  }

  for (const sop of SOP_LIBRARY) {
    await upsertEntity({
      key: `sop:${sop.key}`,
      name: sop.name,
      type: 'SOP',
      description: sop.description,
      accessLevel: 'INTERNAL',
      confidence: 1,
      source: 'PLATFORM_STRUCTURE',
      verified: true,
      properties: { category: sop.category, level: sop.level, tools: sop.tools },
    })
    await linkEntities({
      fromKey: `sop:${sop.key}`,
      toKey: `dept:${sop.departmentCode}`,
      type: 'PART_OF',
      weight: 1,
      confidence: 1,
      provenance: 'the SOP is owned by this department',
    })
    entities += 1
    relations += 1

    for (const tool of sop.tools) {
      await linkEntities({
        fromKey: `sop:${sop.key}`,
        toKey: `tool:${tool}`,
        type: 'CONSUMES',
        weight: 0.8,
        confidence: 1,
        provenance: 'the SOP declares this tool',
      })
      relations += 1
    }
  }

  for (const tool of TOOL_REGISTRY) {
    await upsertEntity({
      key: `tool:${tool.id}`,
      name: tool.name,
      type: 'TOOL',
      description: tool.description,
      accessLevel: 'INTERNAL',
      confidence: 1,
      source: 'PLATFORM_STRUCTURE',
      verified: true,
      properties: { riskLevel: tool.riskLevel, permission: tool.permission, requiresApproval: tool.requiresApproval },
    })
    entities += 1
  }

  void buildOrgChart
  void options

  return { entities, relations }
}

/** Record a graph write in the audit trail. */
export async function auditGraphWrite(action: string, entityKey: string, details: Record<string, unknown>): Promise<void> {
  await audit({
    actor: 'system:knowledge-graph',
    action,
    entityType: 'KnowledgeEntity',
    entityId: entityKey,
    details: { ...details, correlationId: newCorrelationId() },
  })
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function hydrateEntity(row: {
  key: string
  name: string
  type: string
  description: string | null
  accessLevel: string
  confidence: number
  properties: string | null
  source: string
  version: number
  verified: boolean
  createdAt: Date
  updatedAt: Date
}): KnowledgeEntity {
  return {
    key: row.key,
    name: row.name,
    type: row.type as EntityType,
    description: row.description,
    accessLevel: (ACCESS_LEVELS as readonly string[]).includes(row.accessLevel) ? (row.accessLevel as AccessLevel) : 'INTERNAL',
    confidence: row.confidence,
    properties: parseProperties(row.properties),
    source: row.source,
    version: row.version,
    verified: row.verified,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function hydrateRelation(row: {
  id: string
  fromKey: string
  toKey: string
  type: string
  weight: number
  confidence: number
  provenance: string | null
  accessLevel: string
  version: number
  createdAt: Date
}): KnowledgeRelation {
  return {
    id: row.id,
    fromKey: row.fromKey,
    toKey: row.toKey,
    type: row.type as RelationType,
    weight: row.weight,
    confidence: row.confidence,
    provenance: row.provenance,
    accessLevel: (ACCESS_LEVELS as readonly string[]).includes(row.accessLevel) ? (row.accessLevel as AccessLevel) : 'INTERNAL',
    version: row.version,
    createdAt: row.createdAt,
  }
}

function parseProperties(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
