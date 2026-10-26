import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { rememberMemory, recallMemory } from '@/lib/agents/engine'
import {
  ENTERPRISE_SCOPES,
  MEMORY_TYPES,
  memoryStats,
  retrieveMemory,
  writeMemory,
  type MemoryScope,
  type MemoryType,
} from '@/lib/memory/system'
import { ACCESS_LEVELS, type AccessLevel } from '@/lib/rag/store'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/memory — the unified memory system.
 *
 * This route EXTENDS the original memory endpoint. The original
 * contract is preserved: `memories` is still returned with the same
 * shape, and the POST body still accepts scope / key / content /
 * clientId / importance.
 *
 * What is added is the typed, permission-aware view: the memory TYPE
 * (working, episodic, semantic, procedural), the access level, the
 * validation flag, the version, the expiry, and a retrieval preview
 * that uses the SAME permission-aware retriever the runtime uses.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const scope = sanitizeText(url.searchParams.get('scope') ?? '', 30).toUpperCase()
  const clientId = sanitizeText(url.searchParams.get('clientId') ?? '', 40)
  const query = sanitizeText(url.searchParams.get('query') ?? url.searchParams.get('q') ?? '', 100)
  const memoryType = sanitizeText(url.searchParams.get('type') ?? '', 30).toUpperCase()
  const accessParam = sanitizeText(url.searchParams.get('access') ?? '', 200)
  const accessLevels = (
    accessParam
      ? accessParam.split(',').map((level) => level.trim().toUpperCase()).filter((level) => ACCESS_LEVELS.includes(level as AccessLevel))
      : [...ACCESS_LEVELS]
  ) as AccessLevel[]

  // The original listing, preserved.
  const memories = await db.aiMemory.findMany({
    where: {
      ...(scope && ENTERPRISE_SCOPES.includes(scope as MemoryScope) ? { scope } : {}),
      ...(clientId ? { client: { OR: [{ id: clientId }, { clientId }] } } : {}),
      ...(query ? { OR: [{ key: { contains: query } }, { content: { contains: query } }] } : {}),
    },
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    include: { client: { select: { clientId: true, name: true } } },
  })

  // The typed, permission-aware view.
  const stats = await memoryStats(accessLevels)
  const retrieved = await retrieveMemory({
    scopes: scope && ENTERPRISE_SCOPES.includes(scope as MemoryScope) ? [scope as MemoryScope] : [...ENTERPRISE_SCOPES],
    accessLevels,
    memoryTypes: MEMORY_TYPES.includes(memoryType as MemoryType) ? [memoryType as MemoryType] : undefined,
    query: query || undefined,
    limit: Math.max(1, Math.min(25, Number(url.searchParams.get('limit') ?? 12))),
  })

  return Response.json({
    memories,
    stats,
    types: MEMORY_TYPES,
    scopes: ENTERPRISE_SCOPES,
    accessLevels,
    retrieved: retrieved.map((entry) => ({
      id: entry.id,
      scope: entry.scope,
      key: entry.key,
      content: entry.content,
      memoryType: entry.memoryType,
      accessLevel: entry.accessLevel,
      validated: entry.validated,
      version: entry.version,
      source: entry.source,
      importance: entry.importance,
      hits: entry.hits,
      expiresAt: entry.expiresAt,
      updatedAt: entry.updatedAt,
    })),
  })
}

/**
 * POST /api/admin/memory — write a memory.
 *
 * The original body is still accepted. The typed fields are optional;
 * when they are absent the memory is written exactly as before.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const scope = sanitizeText(raw.scope, 30).toUpperCase()
  const key = sanitizeText(raw.key, 120)
  const content = sanitizeText(raw.content, 4000)
  if (!ENTERPRISE_SCOPES.includes(scope as MemoryScope)) {
    return Response.json({ error: `scope must be one of ${ENTERPRISE_SCOPES.join(', ')}` }, { status: 400 })
  }
  if (key.length < 2 || content.length < 5) return Response.json({ error: 'key and content required' }, { status: 400 })
  const clientRef = sanitizeText(raw.clientId, 40)
  const client = clientRef ? await db.client.findFirst({ where: { OR: [{ id: clientRef }, { clientId: clientRef }] } }) : null

  const requestedType = String(raw.memoryType ?? '').toUpperCase()
  const requestedAccess = String(raw.accessLevel ?? '').toUpperCase()
  const memoryType: MemoryType = (MEMORY_TYPES as readonly string[]).includes(requestedType)
    ? (requestedType as MemoryType)
    : 'SEMANTIC'
  const accessLevel: AccessLevel | undefined = (ACCESS_LEVELS as readonly string[]).includes(requestedAccess)
    ? (requestedAccess as AccessLevel)
    : undefined

  // When the typed fields are supplied the new writer is used, so the
  // memory is versioned, permission-tagged and auditable. Otherwise the
  // original engine writer is used, unchanged.
  if (raw.memoryType || raw.accessLevel || raw.validated !== undefined || raw.expiresAt) {
    const written = await writeMemory({
      scope: scope as MemoryScope,
      key,
      content,
      memoryType,
      accessLevel,
      validated: raw.validated === true,
      clientId: client?.id ?? null,
      importance: Math.min(10, Math.max(1, Number(raw.importance ?? 5) || 5)),
      source: 'HUMAN',
      expiresAt: raw.expiresAt ? new Date(String(raw.expiresAt)) : null,
      correlationId: undefined,
      writtenBy: g.user.email,
    })
    await audit({
      actor: g.user.email,
      action: 'MEMORY_WRITTEN',
      userId: g.user.id,
      entityType: 'AiMemory',
      entityId: written.id,
      details: { scope, key, memoryType, accessLevel: written.accessLevel, version: written.version },
    })
    return Response.json({ ok: true, memory: written, message: 'Memory persisted to the database.' })
  }

  const mem = await rememberMemory({
    scope,
    key,
    content,
    clientId: client?.id,
    importance: Math.min(10, Math.max(1, Number(raw.importance ?? 5) || 5)),
  })
  await audit({ actor: g.user.email, action: 'MEMORY_WRITTEN', userId: g.user.id, entityId: mem.id })
  return Response.json({ ok: true, memory: mem, message: 'Memory persisted to the database.' })
}

/** DELETE /api/admin/memory?id=… — expire a memory. It is kept for audit. */
export async function DELETE(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const id = sanitizeText(url.searchParams.get('id') ?? '', 64)
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 })
  const { expireMemory } = await import('@/lib/memory/system')
  await expireMemory(id, 'expired by an administrator')
  await audit({
    actor: g.user.email,
    action: 'MEMORY_EXPIRED',
    userId: g.user.id,
    entityType: 'AiMemory',
    entityId: id,
  })
  return Response.json({ ok: true, id })
}
