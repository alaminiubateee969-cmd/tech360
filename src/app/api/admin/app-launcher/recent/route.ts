/**
 * TECH360 — Private Super Admin App Launcher recent applications.
 *
 * Per-operator recently opened applications persisted in the existing
 * `Setting` model (JSON value) under `app_launcher:recent:<userId>`. No new
 * tables, no migrations.
 *
 * SUPER_ADMIN only.
 */
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guardFailed, noStore, bad, readBody, requireActor } from '@/lib/factory/control/http'

const SETTING_PREFIX = 'app_launcher:recent:'
const MAX_RECENT = 12

function settingKey(userId: string): string {
  return `${SETTING_PREFIX}${userId}`
}

function parseRecent(value: string | null | undefined): Array<{ appId: string; at: string }> {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed as Array<{ appId: string; at: string }> : []
  } catch {
    return []
  }
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const actor = g.actor
  if (!actor.userId) return noStore({ recent: [] })

  const row = await db.setting.findUnique({ where: { key: settingKey(actor.userId) } })
  return noStore({ recent: parseRecent(row?.value) })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const actor = g.actor
  if (!actor.userId) return bad('User identity unavailable', 400)

  const body = await readBody(req)
  const appId = typeof body.appId === 'string' ? body.appId : null
  if (!appId) return bad('appId is required', 400)

  const row = await db.setting.findUnique({ where: { key: settingKey(actor.userId) } })
  const current = parseRecent(row?.value)
  const now = new Date().toISOString()

  const updated = [
    { appId, at: now },
    ...current.filter((entry) => entry.appId !== appId),
  ].slice(0, MAX_RECENT)

  await db.setting.upsert({
    where: { key: settingKey(actor.userId) },
    create: { key: settingKey(actor.userId), value: JSON.stringify(updated) },
    update: { value: JSON.stringify(updated) },
  })
  return noStore({ recent: updated })
}
