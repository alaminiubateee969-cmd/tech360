import { NextRequest } from 'next/server'
import { AI_WORKFORCE_GOVERNANCE_ROLE } from '@/lib/ai-workforce-policy'
import { guard, isResponse } from '@/lib/api-guard'
import { createEvolutionReviewPacket } from '@/lib/agents/evolution/preflight'

export const dynamic = 'force-dynamic'
const MAX_BODY_BYTES = 64_000

// Limit the stream itself, rather than trusting Content-Length.
async function readBoundedBody(req: Request): Promise<string> {
  if (!req.body) throw new Error('Empty body')
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new Error('Body too large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(merged)
}

/** Review metadata only. No agent execution, patch application or persistence. */
export async function POST(req: NextRequest) {
  const access = await guard(req, { minRole: AI_WORKFORCE_GOVERNANCE_ROLE, limit: { max: 10, windowMs: 60_000 } })
  if (isResponse(access)) return access
  try {
    const body: unknown = JSON.parse(await readBoundedBody(req))
    const packet = createEvolutionReviewPacket(body)
    return Response.json(packet, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ error: 'Invalid review request or request too large.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
