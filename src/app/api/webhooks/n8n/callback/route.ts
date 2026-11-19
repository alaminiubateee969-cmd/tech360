import { NextRequest } from 'next/server'
import { clientIp, logError, rateLimit, sanitizeText } from '@/lib/security'
import { handleN8nCallback, N8N_CORRELATION_HEADER, N8N_SIGNATURE_HEADER, N8N_TIMESTAMP_HEADER, verifyN8nCallbackSignature } from '@/lib/n8n/adapter'

export const dynamic = 'force-dynamic'

// WEBHOOK — n8n execution status callback.
// Auth: HMAC-SHA256 over `${timestamp}.${rawBody}` with N8N_CALLBACK_SECRET,
// headers x-tech360-signature (sha256=hex) + x-tech360-timestamp (ms, ±5 min).
// Body: { correlationId, status: RUNNING|SUCCEEDED|FAILED, output?, error? }.
// Idempotent: a repeated terminal callback returns duplicate:true and changes nothing.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`n8n-callback:${clientIp(req)}`, 120, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })
  const rawBody = await req.text()
  if (rawBody.length > 100_000) return Response.json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 })

  const verdict = verifyN8nCallbackSignature({
    rawBody,
    signature: req.headers.get(N8N_SIGNATURE_HEADER),
    timestamp: req.headers.get(N8N_TIMESTAMP_HEADER),
  })
  if (!verdict.ok) {
    if (verdict.code !== 'N8N_NOT_CONFIGURED') {
      await logError({ source: 'N8N_CALLBACK', code: verdict.code, message: `Rejected n8n callback from ${clientIp(req)}` }).catch(() => null)
    }
    return Response.json({ error: verdict.error, code: verdict.code }, { status: verdict.status })
  }

  let body: Record<string, unknown>
  try { body = JSON.parse(rawBody) as Record<string, unknown> } catch { return Response.json({ error: 'Invalid JSON', code: 'BAD_JSON' }, { status: 400 }) }
  const correlationId = sanitizeText(body.correlationId, 191) || sanitizeText(req.headers.get(N8N_CORRELATION_HEADER), 191)
  if (!correlationId) return Response.json({ error: 'correlationId is required', code: 'CORRELATION_REQUIRED' }, { status: 400 })
  const result = await handleN8nCallback({
    correlationId,
    status: sanitizeText(body.status, 20),
    output: body.output,
    error: body.error ? sanitizeText(body.error, 2000) : null,
  })
  if (!result.ok) {
    return Response.json(
      { error: result.code === 'UNKNOWN_CORRELATION' ? 'Unknown correlation id' : 'status must be RUNNING, SUCCEEDED or FAILED', code: result.code },
      { status: result.code === 'UNKNOWN_CORRELATION' ? 404 : 400 },
    )
  }
  return Response.json({ ok: true, duplicate: result.duplicate, status: result.execution.status, correlationId })
}
