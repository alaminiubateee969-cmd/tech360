import { createHmac } from 'node:crypto'
import { constantTimeEquals } from '@/lib/constant-time'

export type EmailWebhookAuthResult =
  | { ok: true; method: 'hmac' | 'shared-secret' }
  | { ok: false; reason: 'NOT_CONFIGURED' | 'MISSING_AUTH' | 'INVALID_AUTH' }

/**
 * Verify an inbound email webhook using a dedicated EMAIL_WEBHOOK_SECRET.
 * Providers may send a raw-body SHA-256 signature or the same key in the
 * dedicated x-email-webhook-secret header. Legacy social/n8n secrets and
 * secrets embedded in JSON bodies are deliberately not accepted.
 */
export function verifyEmailWebhookAuth(input: {
  rawBody: string
  secret: string | null | undefined
  signature: string | null | undefined
  sharedSecret: string | null | undefined
}): EmailWebhookAuthResult {
  const secret = input.secret?.trim() ?? ''
  if (Buffer.byteLength(secret, 'utf8') < 32) return { ok: false, reason: 'NOT_CONFIGURED' }

  const signature = input.signature?.trim() ?? ''
  if (signature) {
    const expected = `sha256=${createHmac('sha256', secret).update(input.rawBody, 'utf8').digest('hex')}`
    if (constantTimeEquals(signature.toLowerCase(), expected)) return { ok: true, method: 'hmac' }
  }

  const sharedSecret = input.sharedSecret?.trim() ?? ''
  if (sharedSecret && constantTimeEquals(sharedSecret, secret)) {
    return { ok: true, method: 'shared-secret' }
  }

  return {
    ok: false,
    reason: signature || sharedSecret ? 'INVALID_AUTH' : 'MISSING_AUTH',
  }
}
