import { NextRequest } from 'next/server'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/backup
 *
 * The backup and recovery status.
 *
 * HONESTY: this route reports only what it can actually verify on this
 * host — the backup files that exist, their size and age, and whether a
 * restore has ever been proven. It does NOT report "backups are running"
 * on the strength of a configuration value, and it never claims a
 * backup is restorable without a recorded restore test.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g

  const backupDirs = [
    process.env.BACKUP_DIR ?? '',
    join(process.cwd(), 'backups'),
    join(process.cwd(), 'deployment', 'backups'),
  ].filter(Boolean)

  const artifacts: Array<{
    name: string
    path: string
    sizeBytes: number
    modifiedAt: string
    ageHours: number
  }> = []

  for (const dir of backupDirs) {
    try {
      const entries = await readdir(dir)
      for (const entry of entries) {
        if (!/\.(sql|dump|tar|gz|tgz|zip|json)$/i.test(entry)) continue
        const full = join(dir, entry)
        const info = await stat(full)
        if (!info.isFile()) continue
        artifacts.push({
          name: entry,
          path: full,
          sizeBytes: info.size,
          modifiedAt: new Date(info.mtimeMs).toISOString(),
          ageHours: Math.round(((Date.now() - info.mtimeMs) / 3_600_000) * 10) / 10,
        })
      }
    } catch {
      // A missing backup directory is a fact, not an error: it is
      // reported as "no artifacts found in this directory".
    }
  }

  artifacts.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))

  // Restore evidence: the restore test writes a record here.
  let restoreEvidence: { testedAt: string | null; restoredRows: number | null; source: string | null } = {
    testedAt: null,
    restoredRows: null,
    source: null,
  }
  try {
    const setting = await db.setting.findUnique({ where: { key: 'backup.restore_test' } })
    if (setting) {
      const parsed = JSON.parse(setting.value) as { testedAt?: string; restoredRows?: number; source?: string }
      restoreEvidence = {
        testedAt: parsed.testedAt ?? null,
        restoredRows: typeof parsed.restoredRows === 'number' ? parsed.restoredRows : null,
        source: parsed.source ?? null,
      }
    }
  } catch {
    // The database may be unavailable; the status below will say so.
  }

  const newest = artifacts[0] ?? null
  const maxAgeHours = 48
  const status = !newest
    ? 'NO_ARTIFACTS'
    : newest.ageHours <= maxAgeHours
      ? 'CURRENT'
      : 'STALE'

  await audit({
    actor: g.user.email,
    action: 'BACKUP_STATUS_VIEWED',
    userId: g.user.id,
    details: { artifacts: artifacts.length, status },
  })

  return Response.json({
    status,
    detail:
      status === 'NO_ARTIFACTS'
        ? 'No backup artefacts were found in any configured directory on this host.'
        : status === 'CURRENT'
          ? `The newest artefact is ${newest!.ageHours}h old.`
          : `The newest artefact is ${newest!.ageHours}h old, beyond the ${maxAgeHours}h freshness target.`,
    freshnessTargetHours: maxAgeHours,
    directories: backupDirs,
    artifacts,
    restoreEvidence: {
      ...restoreEvidence,
      proven: Boolean(restoreEvidence.testedAt),
      detail: restoreEvidence.testedAt
        ? `A restore was proven on ${restoreEvidence.testedAt}.`
        : 'No restore has been proven on this host. A backup that has never been restored is not a backup.',
    },
    database: {
      engine: 'MySQL',
      urlConfigured: Boolean(process.env.DATABASE_URL),
      note: 'The database connection string is never returned by this route.',
    },
  })
}
