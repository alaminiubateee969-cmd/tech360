/**
 * TECH360 — Private Super Admin App Launcher favorites.
 *
 * Per-operator favorite applications persisted in the existing `Setting`
 * model (JSON value) under `app_launcher:favorites:<userId>`. No new tables,
 * no migrations, no duplicate preference store.
 *
 * SUPER_ADMIN only.
 */
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guardFailed, noStore, bad, readBody, requireActor } from '@/lib/factory/control/http'

const SETTING_PREFIX = 'app_launcher:favorites:'

function settingKey(userId: string): string {
  return `${SETTING_PREFIX}${userId}`
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const actor = g.actor
  if (!actor.userId) return noStore({ favorites: [] })

  const row = await db.setting.findUnique({ where: { key: settingKey(actor.userId) } })
  const favorites: string[] = row
    ? (() => { try { return JSON.parse(row.value) } catch { return [] } })()
    : []
  return noStore({ favorites })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const actor = g.actor
  if (!actor.userId) return bad('User identity unavailable', 400)

  const body = await readBody(req)
  const appId = typeof body.appId === 'string' ? body.appId : null
  const add = body.add === true
  if (!appId) return bad('appId is required', 400)

  const row = await db.setting.findUnique({ where: { key: settingKey(actor.userId) } })
  const current: string[] = row
    ? (() => { try { return JSON.parse(row.value) } catch { return [] } })()
    : []

  let updated: string[]
  if (add) {
    if (current.includes(appId)) return noStore({ favorites: current })
    updated = [...current, appId]
  } else {
    updated = current.filter((id) => id !== appId)
  }

  await db.setting.upsert({
    where: { key: settingKey(actor.userId) },
    create: { key: settingKey(actor.userId), value: JSON.stringify(updated) },
    update: { value: JSON.stringify(updated) },
  })
  return noStore({ favorites: updated, appId, added: add })
}
