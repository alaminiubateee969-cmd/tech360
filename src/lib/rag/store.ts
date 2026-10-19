// ============================================================
// TECH360 — vector knowledge store
// ============================================================
// MySQL-backed vector store. MySQL has no native vector type, so the
// embedding is stored as a JSON array in a LONGTEXT column and the
// cosine similarity is computed in the application over a bounded
// candidate set.
//
// LIMITATION (documented, not hidden): this is a linear scan. It is
// correct for the company's current corpus size (thousands of chunks).
// When the corpus outgrows a single bounded scan, the storage adapter
// is the only thing that changes — the retrieval contract does not.
//
// ACCESS ISOLATION: every chunk carries an access level. A query is
// always filtered by the CALLER's granted levels, so a caller can never
// retrieve a chunk above their clearance. This is enforced in the
// WHERE clause, not in application code after the fact.
// ============================================================

import { db } from '@/lib/db'
import { cosineSimilarity } from './embeddings'

export const ACCESS_LEVELS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === 'string' && (ACCESS_LEVELS as readonly string[]).includes(value)
}

/** The most restrictive level a caller holds. */
export function highestAccessLevel(levels: AccessLevel[]): AccessLevel {
  const order = ACCESS_LEVELS as readonly string[]
  let best: AccessLevel = 'PUBLIC'
  for (const level of levels) {
    if (order.indexOf(level) > order.indexOf(best)) best = level
  }
  return best
}

export type StoredChunk = {
  id: string
  documentId: string
  chunkIndex: number
  content: string
  accessLevel: AccessLevel
  model: string | null
  score: number
}

const DEFAULT_CANDIDATE_LIMIT = 2000

export async function indexChunks(input: {
  documentId: string
  chunks: Array<{ index: number; content: string; checksum: string }>
  vectors: number[][]
  model: string
  accessLevel: AccessLevel
}): Promise<number> {
  if (input.chunks.length !== input.vectors.length) {
    throw new Error('chunk and vector counts differ — refusing to index a partial document')
  }
  const dimensions = input.vectors[0]?.length ?? 0
  await db.$transaction(
    input.chunks.map((chunk, index) =>
      db.knowledgeChunk.upsert({
        where: { documentId_chunkIndex: { documentId: input.documentId, chunkIndex: chunk.index } },
        update: {
          content: chunk.content,
          embedding: JSON.stringify(input.vectors[index]),
          dimensions,
          model: input.model,
          accessLevel: input.accessLevel,
          checksum: chunk.checksum,
        },
        create: {
          documentId: input.documentId,
          chunkIndex: chunk.index,
          content: chunk.content,
          embedding: JSON.stringify(input.vectors[index]),
          dimensions,
          model: input.model,
          accessLevel: input.accessLevel,
          checksum: chunk.checksum,
        },
      }),
    ),
  )
  return input.chunks.length
}

export async function deleteDocumentChunks(documentId: string): Promise<number> {
  const result = await db.knowledgeChunk.deleteMany({ where: { documentId } })
  return result.count
}

/**
 * Retrieve the most similar chunks the caller is allowed to see.
 * The access filter is part of the database query.
 */
export async function searchChunks(input: {
  queryVector: number[]
  accessLevels: AccessLevel[]
  limit?: number
  documentIds?: string[]
  candidateLimit?: number
}): Promise<StoredChunk[]> {
  const limit = Math.max(1, Math.min(50, input.limit ?? 8))
  const levels = input.accessLevels.length > 0 ? input.accessLevels : (['PUBLIC'] as AccessLevel[])
  const rows = await db.knowledgeChunk.findMany({
    where: {
      accessLevel: { in: levels },
      ...(input.documentIds?.length ? { documentId: { in: input.documentIds } } : {}),
    },
    select: {
      id: true,
      documentId: true,
      chunkIndex: true,
      content: true,
      embedding: true,
      accessLevel: true,
      model: true,
    },
    take: Math.max(limit * 25, Math.min(DEFAULT_CANDIDATE_LIMIT, input.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT)),
    orderBy: { createdAt: 'desc' },
  })

  const allowed = new Set(levels)
  const scored: StoredChunk[] = []
  for (const row of rows) {
    // Defence in depth: the access filter is applied in the database
    // query AND re-checked here. A misconfigured store, a stubbed
    // client or a migration error must not be able to return a chunk
    // above the caller's clearance.
    if (!allowed.has(row.accessLevel as AccessLevel)) continue
    if (!row.embedding) continue
    let vector: number[]
    try {
      vector = JSON.parse(row.embedding) as number[]
    } catch {
      continue
    }
    if (!Array.isArray(vector) || vector.length !== input.queryVector.length) continue
    scored.push({
      id: row.id,
      documentId: row.documentId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      accessLevel: row.accessLevel as AccessLevel,
      model: row.model,
      score: Math.round(cosineSimilarity(input.queryVector, vector) * 10_000) / 10_000,
    })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

export async function countChunks(accessLevels?: AccessLevel[]): Promise<number> {
  return db.knowledgeChunk.count({
    where: accessLevels?.length ? { accessLevel: { in: accessLevels } } : {},
  })
}
