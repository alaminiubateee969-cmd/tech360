import { db } from '@/lib/db'

/**
 * Central notification writer — every notification row is created by the
 * platform itself (journey events, ops loop, moderation, portal actions).
 */
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
}
