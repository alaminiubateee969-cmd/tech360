import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createBackup, portableArchive, restoreBackup, verifyBackup } from '@/lib/factory/control/backup'
import { bad, guardFailed, noStore, readBody, requireActor, text } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const url = new URL(req.url)
  const download = text(url.searchParams.get('download'), 60)
  const companyId = text(url.searchParams.get('companyId'), 60)
  if (download) {
    const row = await db.factoryBackup.findUnique({ where: { id: download } })
    if (!row) return bad('Backup not found', 404)
    const archive = portableArchive(row)
    return new Response(archive, { headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${row.code}-portable.json"`,
      'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
    } })
  }
  const rows = await db.factoryBackup.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { createdAt: 'desc' }, take: 100,
    select: { id: true, code: true, applicationId: true, companyId: true, kind: true, status: true, checksum: true, sizeBytes: true, verifiedAt: true, restoredAt: true, restoreTarget: true, createdBy: true, createdAt: true },
  })
  return noStore({ backups: rows, total: rows.length, note: 'VERIFIED means the checksum and integrity checks actually passed; an existing row alone is not a verified backup.' })
}

export async function POST(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const body = await readBody(req)
  const action = text(body.action, 24).toLowerCase()
  if (action === 'create') {
    const applicationId = text(body.applicationId, 60)
    if (!applicationId) return bad('applicationId is required')
    const kind = ['FULL', 'CONFIG_ONLY', 'PRE_UPGRADE'].includes(String(body.kind)) ? String(body.kind) : 'FULL'
    const row = await createBackup(applicationId, kind, g.actor)
    return noStore({ backup: { id: row.id, code: row.code, status: row.status, sizeBytes: row.sizeBytes, checksum: row.checksum } }, 201)
  }
  if (action === 'verify') {
    const id = text(body.backupId, 60)
    if (!id) return bad('backupId is required')
    return noStore(await verifyBackup(id, g.actor))
  }
  if (action === 'restore') {
    const id = text(body.backupId, 60)
    if (!id) return bad('backupId is required')
    const requested = text(body.companyId, 60) || undefined
    const result = await restoreBackup(id, g.actor, requested)
    return noStore(result, result.ok ? 200 : 400)
  }
  return bad(`Unknown action "${action}"`)
}
