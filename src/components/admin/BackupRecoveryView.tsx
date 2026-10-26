'use client'

import { Clock, DatabaseBackup, HardDriveDownload, RefreshCw, ShieldAlert, Terminal, XCircle } from 'lucide-react'

import { useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'

// ============================================================
// BACKUP AND RECOVERY
//
// This panel reports only what it can verify on THIS host:
// the artefacts that exist, their age, and whether a restore has ever
// been proven. A backup that has never been restored is reported as
// unproven — it is not called a backup.
// ============================================================

type BackupArtifact = {
  name: string
  path: string
  sizeBytes: number
  modifiedAt: string
  ageHours: number
}

type BackupResponse = {
  status: 'CURRENT' | 'STALE' | 'NO_ARTIFACTS'
  detail: string
  freshnessTargetHours: number
  directories: string[]
  artifacts: BackupArtifact[]
  restoreEvidence: {
    testedAt: string | null
    restoredRows: number | null
    source: string | null
    proven: boolean
    detail: string
  }
  database: { engine: string; urlConfigured: boolean; note: string }
  runner: {
    healthy: boolean
    reason: string
    lastRun: {
      status?: string
      code?: string
      file?: string
      sizeBytes?: number
      sha256?: string
      tables?: number
      database?: string
      finishedAt?: string
      durationSec?: number
      offsite?: string
      retention?: { kept?: number; deleted?: number }
      directory: string
      ageHours: number
    } | null
    lastDrill: {
      status?: string
      code?: string
      targetDatabase?: string
      dump?: string
      restoredTables?: number
      finishedAt?: string
      directory: string
      ageHours: number
    } | null
    schedule: {
      script: string
      restoreDrill: string
      trigger: string
      documentedSchedule: string
      offsiteConfigured: boolean
      alertWebhookConfigured: boolean
    }
    note: string
  }
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function BackupRecoveryView() {
  const { data, loading, error, refresh } = useApi<BackupResponse>('/api/admin/backup')

  return (
    <div>
      <PageHeader
        title="Backup and Recovery"
        description="The verified state of this host's backups and the evidence that a restore has actually worked."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh backup status">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error ? <EmptyState icon={XCircle} title="Backup status could not be loaded" description={error} /> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Backup status"
          value={data?.status ?? '—'}
          icon={DatabaseBackup}
          tone={data?.status === 'CURRENT' ? 'green' : data?.status === 'NO_ARTIFACTS' ? 'red' : 'amber'}
          loading={loading}
          sub={data?.detail ?? ''}
        />
        <KpiCard label="Artefacts" value={data?.artifacts.length ?? '—'} icon={HardDriveDownload} tone="accent" loading={loading} sub="found on this host" />
        <KpiCard
          label="Restore proven"
          value={data?.restoreEvidence.proven ? 'YES' : 'NO'}
          icon={ShieldAlert}
          tone={data?.restoreEvidence.proven ? 'green' : 'red'}
          loading={loading}
          sub={data?.restoreEvidence.detail ?? ''}
        />
        <KpiCard
          label="Automation"
          value={data ? (data.runner?.healthy ? 'VERIFIED' : 'UNVERIFIED') : '—'}
          icon={Clock}
          tone={data?.runner?.healthy ? 'green' : 'amber'}
          loading={loading}
          sub={data?.runner?.reason ?? 'scheduled runner evidence'}
        />
      </div>

      <SectionCard
        title="Scheduled runner"
        description="What the backup automation itself recorded — the only trustworthy evidence that the job ran."
      >
        <div className={CARD + ' p-4'}>
          <p className={data?.runner?.healthy ? 'text-sm text-emerald-300' : 'text-sm text-amber-300'}>
            {data?.runner?.reason ?? 'Loading…'}
          </p>

          <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Last run status</dt>
              <dd className={MONO}>{data?.runner?.lastRun ? `${data.runner.lastRun.status}${data.runner.lastRun.code ? ` (${data.runner.lastRun.code})` : ''}` : 'never recorded'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Last successful run</dt>
              <dd className={MONO}>{data?.runner?.lastRun?.finishedAt ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Recorded size / tables</dt>
              <dd className={MONO}>
                {data?.runner?.lastRun?.sizeBytes ? fmtBytes(data.runner.lastRun.sizeBytes) : '—'} · {data?.runner?.lastRun?.tables ?? '—'} tables
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">SHA-256</dt>
              <dd className={MONO}>{data?.runner?.lastRun?.sha256 ? `${data.runner.lastRun.sha256.slice(0, 16)}…` : '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Off-server copy</dt>
              <dd className={MONO}>{data?.runner?.lastRun?.offsite ?? (data?.runner?.schedule.offsiteConfigured ? 'configured' : 'not configured')}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Retention (kept / deleted)</dt>
              <dd className={MONO}>
                {data?.runner?.lastRun?.retention
                  ? `${data.runner.lastRun.retention.kept ?? 0} / ${data.runner.lastRun.retention.deleted ?? 0}`
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Last restore drill</dt>
              <dd className={MONO}>
                {data?.runner?.lastDrill
                  ? `${data.runner.lastDrill.status} · ${data.runner.lastDrill.targetDatabase ?? ''} · ${data.runner.lastDrill.restoredTables ?? '?'} tables`
                  : 'never recorded'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Documented schedule</dt>
              <dd className={MONO}>{data?.runner?.schedule.documentedSchedule ?? '—'}</dd>
            </div>
          </dl>

          <div className="mt-3 space-y-1 text-[11px] text-slate-500">
            <p className="flex items-center gap-1.5">
              <Terminal className="size-3" aria-hidden="true" />
              <span className={MONO}>{data?.runner?.schedule.script ?? 'scripts/backup/mysql-backup.sh'}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Terminal className="size-3" aria-hidden="true" />
              <span className={MONO}>{data?.runner?.schedule.restoreDrill ?? 'scripts/backup/mysql-restore-drill.sh'}</span>
            </p>
            <p>Trigger: {data?.runner?.schedule.trigger ?? 'host scheduler'}</p>
            <p>{data?.runner?.note ?? ''}</p>
          </div>
        </div>
      </SectionCard>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-2">
        <KpiCard label="Freshness target" value={data ? `${data.freshnessTargetHours}h` : '—'} icon={HardDriveDownload} tone="slate" loading={loading} sub="newest artefact age limit" />
        <KpiCard label="Artefact directory" value={data?.runner?.lastRun?.directory ? 'FOUND' : '—'} icon={DatabaseBackup} tone="slate" loading={loading} sub={data?.runner?.lastRun?.directory ?? 'no runner record'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Backup artefacts" description="Files that actually exist in the configured directories.">
          {loading && !data ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-slate-800/50" />
              ))}
            </div>
          ) : (data?.artifacts.length ?? 0) === 0 ? (
            <EmptyState
              icon={DatabaseBackup}
              title="No backup artefact was found on this host"
              description="Nothing has been written to the configured backup directories. Backups are not running here."
            />
          ) : (
            <div className="space-y-2">
              {data?.artifacts.map((artifact) => (
                <div key={artifact.path} className={CARD + ' p-3'}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs text-slate-200" title={artifact.path}>
                      {artifact.name}
                    </span>
                    <StatusBadge status={artifact.ageHours <= (data?.freshnessTargetHours ?? 48) ? 'CURRENT' : 'STALE'} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {fmtBytes(artifact.sizeBytes)} · {artifact.ageHours}h old · {new Date(artifact.modifiedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Restore evidence" description="A backup that has never been restored is not a backup.">
          <div className={CARD + ' p-4'}>
            <p className="text-sm text-slate-300">{data?.restoreEvidence.detail ?? 'Loading…'}</p>
            {data?.restoreEvidence.testedAt ? (
              <dl className="mt-3 space-y-1 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Restore tested at</dt>
                  <dd className={MONO}>{data.restoreEvidence.testedAt}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Rows restored</dt>
                  <dd className={MONO}>{data.restoreEvidence.restoredRows ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Source</dt>
                  <dd className={MONO}>{data.restoreEvidence.source ?? '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-[11px] text-amber-400/90">
                No restore test has been recorded. Run the restore test from the deployment runbook before any production
                release.
              </p>
            )}
          </div>

          <div className="mt-3 space-y-1 text-[11px] text-slate-500">
            <p>Searched directories:</p>
            {(data?.directories ?? []).map((dir) => (
              <p key={dir} className={MONO}>
                {dir}
              </p>
            ))}
            <p className="pt-1 text-slate-600">{data?.database.note}</p>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
