'use client'

import { prettify } from '@/lib/admin-client'
import { cn } from '@/lib/utils'

export type StatusTone = 'green' | 'amber' | 'red' | 'blue' | 'slate'

const GREEN_SET = new Set([
  'PAID', 'SENT', 'DELIVERED', 'READ', 'APPROVED', 'COMPLETED', 'ACTIVE', 'CONFIGURED',
  'RELEASED', 'DOWNLOADED', 'CONFIRMED', 'DONE', 'FINAL', 'CLEAN', 'SCANNED', 'INDEXED',
  'SUCCESS', 'CONVERTED', 'PUBLISHED', 'READY', 'EXECUTED', 'OPERATIONAL', 'UP', 'RECEIVED',
  'LOW',
])
const AMBER_SET = new Set([
  'PENDING', 'QUEUED', 'DRAFT', 'NOT_CONFIGURED', 'AWAITING_APPROVAL', 'PARTIAL', 'UPLOADED',
  'REQUESTED', 'RETRYING', 'GENERATED', 'PLANNING', 'RESEARCHING', 'SCRIPTING', 'PRODUCING',
  'LEARNING', 'SCORING', 'ON_HOLD', 'IMPORTED', 'AVAILABLE', 'PROCESSING', 'MEDIUM',
  'AWAITING_APPROVAL', 'SCHEDULED', 'QUARANTINED',
])
const RED_SET = new Set([
  'FAILED', 'ERROR', 'REJECTED', 'CANCELLED', 'OVERDUE', 'EXPIRED', 'LOST', 'TIMEOUT',
  'CRITICAL', 'BLOCKED', 'DOWN', 'HIGH', 'DELETED',
])
const BLUE_SET = new Set([
  'RUNNING', 'IN_PROGRESS', 'REVIEW', 'NEW', 'VIEWED', 'CLIENT_REVIEW', 'RECEIVED',
  'CONTACTED', 'DEVELOPMENT', 'TESTING', 'SUBMITTED',
])

const TONE_CLASSES: Record<StatusTone, string> = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  red: 'border-red-500/30 bg-red-500/10 text-red-400',
  blue: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  slate: 'border-slate-600/40 bg-slate-700/20 text-slate-300',
}

export function statusTone(status?: string | null): StatusTone {
  const s = (status ?? '').toUpperCase()
  if (GREEN_SET.has(s)) return 'green'
  if (AMBER_SET.has(s)) return 'amber'
  if (RED_SET.has(s)) return 'red'
  if (BLUE_SET.has(s)) return 'blue'
  return 'slate'
}

export function StatusBadge({
  status,
  className,
  title,
}: {
  status?: string | null
  className?: string
  title?: string
}) {
  if (!status) return <span className="text-slate-600">—</span>
  const tone = statusTone(status)
  return (
    <span
      title={title ?? prettify(status)}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-80" aria-hidden="true" />
      {prettify(status)}
    </span>
  )
}

export function RiskBadge({ risk }: { risk?: string | null }) {
  const s = (risk ?? '').toUpperCase()
  const cls =
    s === 'CRITICAL'
      ? 'border-red-500/50 bg-red-500/15 text-red-400'
      : s === 'HIGH'
        ? 'border-red-500/30 bg-red-500/10 text-red-400'
        : s === 'MEDIUM'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        cls,
      )}
    >
      {s || '—'}
    </span>
  )
}
