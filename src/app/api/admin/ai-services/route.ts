import { guard, isResponse } from '@/lib/api-guard'
import { AI_OPERATOR_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { AI_SERVICES, fetchFreeModels } from '@/lib/free-ai-services'

export const dynamic = 'force-dynamic'
export async function GET(req: Request) {
  const g = await guard(req, { minRole: AI_OPERATOR_MIN_ROLE })
  if (isResponse(g)) return g
  try {
    return Response.json({ services: AI_SERVICES, models: await fetchFreeModels(), configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()), checkedAt: new Date().toISOString() })
  } catch {
    return Response.json({ services: AI_SERVICES, models: [], configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()), error: 'Live catalog unavailable. No cached model is assumed free.' })
  }
}
export async function POST(req: Request) {
  const g = await guard(req, { minRole: AI_OPERATOR_MIN_ROLE, limit: { max: 10, windowMs: 60000 } })
  if (isResponse(g)) return g
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body?.message !== 'string' || !body.message.trim() || body.message.length > 4000 || typeof body.model !== 'string') {
    return Response.json({ error: 'Select a model and enter 1–4000 characters.' }, { status: 400 })
  }
  const key = process.env.OPENROUTER_API_KEY?.trim()
  if (!key) return Response.json({ error: 'Server administrator must configure OPENROUTER_API_KEY.' }, { status: 503 })
  try {
    const models = await fetchFreeModels()
    if (!models.some((m) => m.id === body.model)) return Response.json({ error: 'Model is not currently listed as zero-price.' }, { status: 400 })
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: body.model, max_tokens: 1024, provider: { max_price: { prompt: 0, completion: 0 } }, messages: [
        { role: 'system', content: 'You are the Tech360 assistant. You have no tools or access to live company data. Never claim to have performed an action. Use the Oracle console for platform commands.' },
        { role: 'user', content: body.message.trim() },
      ] }),
    })
    if (!response.ok) return Response.json({ error: response.status === 429 ? 'Provider quota reached. Try later; no paid fallback was used.' : 'Provider request failed; no paid fallback was used.' }, { status: response.status === 429 ? 429 : 502 })
    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) throw new Error('Empty response')
    return Response.json({ reply, model: body.model })
  } catch { return Response.json({ error: 'Provider or live pricing check unavailable. Request failed closed.' }, { status: 502 }) }
}
