import { db } from '@/lib/db'

/**
 * Central notification writer — every notification row is created by the
 * platform itself (journey events, ops loop, moderation, portal actions).
 *
 * After persisting, a "ping" is fired at the notify-relay service
 * (mini-services/notify-relay, port 3032) so connected admin consoles
 * refetch their feed instantly instead of waiting for the 60s poll.
 * The ping carries NO business data (kind + severity only — the browser
 * refetches via the authenticated API). Fire-and-forget: if the relay is
 * down (e.g. production without the sidecar) the write still succeeds
 * and polling remains the honest fallback.
 */

const RELAY_URL = process.env.NOTIFY_RELAY_URL ?? 'http://127.0.0.1:3032'
// No known default token in production: without NOTIFY_RELAY_TOKEN the relay ping is skipped.
const RELAY_TOKEN = process.env.NOTIFY_RELAY_TOKEN ?? (process.env.NODE_ENV === 'production' ? '' : 'tech360-notify-dev-token')

async function pingRelay(kind: string, severity: 'INFO' | 'WARNING' | 'CRITICAL'): Promise<void> {
  if (!RELAY_TOKEN) return
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1200)
  try {
    await fetch(`${RELAY_URL}/emit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-relay-token': RELAY_TOKEN },
      body: JSON.stringify({ kind, severity }),
      signal: controller.signal,
    })
  } catch {
    // relay unavailable — polling covers the consoles, never fail the caller
  } finally {
    clearTimeout(timer)
  }
}

export async function createNotification(input: {
  type: string
  title: string
  body: string
  severity?: 'INFO' | 'WARNING' | 'CRITICAL'
  link?: string
  clientId?: string
}): Promise<void> {
  await db.notification
    .create({
      data: {
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body.slice(0, 500),
        severity: input.severity ?? 'INFO',
        link: input.link ?? null,
      },
    })
    .catch(() => null)

  // Real-time ping (kind + severity only — zero business data over the socket)
  void pingRelay(input.type, input.severity ?? 'INFO')
}
