import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { readJson, sanitizeText, audit } from '@/lib/security'
import { rememberMemory, recallMemory } from '@/lib/agents/engine'

export const dynamic = 'force-dynamic'

const SCOPES = ['COMPANY', 'BRAND', 'SERVICES', 'PRICING', 'POLICIES', 'CLIENT', 'PROJECT', 'COMMUNICATION', 'WORKFLOW', 'KNOWLEDGE', 'AGENT', 'TASK', 'LESSON']

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const url = new URL(req.url)
  const scope = sanitizeText(url.searchParams.get('scope') ?? '', 30).toUpperCase()
  const clientId = sanitizeText(url.searchParams.get('clientId') ?? '', 40)
  const query = sanitizeText(url.searchParams.get('query') ?? url.searchParams.get('q') ?? '', 100)
  const memories = await db.aiMemory.findMany({
    where: {
      ...(scope && SCOPES.includes(scope) ? { scope } : {}),
      ...(clientId ? { client: { OR: [{ id: clientId }, { clientId }] } } : {}),
      ...(query ? { OR: [{ key: { contains: query } }, { content: { contains: query } }] } : {}),
    },
    orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    include: { client: { select: { clientId: true, name: true } } },
  })
  return Response.json({ memories })
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const raw = await readJson(req)
  const scope = sanitizeText(raw.scope, 30).toUpperCase()
  const key = sanitizeText(raw.key, 120)
  const content = sanitizeText(raw.content, 4000)
  if (!SCOPES.includes(scope)) return Response.json({ error: `scope must be one of ${SCOPES.join(', ')}` }, { status: 400 })
  if (key.length < 2 || content.length < 5) return Response.json({ error: 'key and content required' }, { status: 400 })
  const clientRef = sanitizeText(raw.clientId, 40)
  const client = clientRef ? await db.client.findFirst({ where: { OR: [{ id: clientRef }, { clientId: clientRef }] } }) : null
  const mem = await rememberMemory({
    scope, key, content, clientId: client?.id,
    importance: Math.min(10, Math.max(1, Number(raw.importance ?? 5) || 5)),
  })
  await audit({ actor: g.user.email, action: 'MEMORY_WRITTEN', userId: g.user.id, entityId: mem.id })
  return Response.json({ ok: true, memory: mem, message: 'Memory persisted to the database.' })
}
