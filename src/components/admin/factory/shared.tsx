'use client'

/** Shared UI primitives for the Software Factory Control Center. */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, fetchJson } from '@/lib/admin-client'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { CARD, INPUT, MONO } from '@/components/admin/shared/styles'
import { cn } from '@/lib/utils'

export type Row = Record<string, any>

export async function apiPost<T = Row>(path: string, body: Row): Promise<T> {
  return fetchJson<T>(path, { method: 'POST', body })
}

export async function apiPatch<T = Row>(path: string, body: Row): Promise<T> {
  return fetchJson<T>(path, { method: 'PATCH', body })
}

export function actionError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return error instanceof Error ? error.message : 'Request failed'
}

/** Small SWR-like hook with an explicit reload signal shared across panels. */
export function useEndpoint<T = Row>(path: string | null, tick = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [localTick, setLocalTick] = useState(0)
  const reload = useCallback(() => setLocalTick((t) => t + 1), [])
  useEffect(() => {
    let active = true
    if (!path) { setLoading(false); return }
    setLoading(true)
    fetch(path, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error((json && (json.error || json.reason)) || `Request failed (${res.status})`)
        return json as T
      })
      .then((json) => { if (active) { setData(json); setError(null) } })
      .catch((e: unknown) => { if (active) setError(actionError(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [path, tick, localTick])
  return { data, error, loading, reload }
}

export function useAction(refresh: () => void) {
  const [busy, setBusy] = useState<string | null>(null)
  const run = useCallback(async (key: string, path: string, body: Row, onDone?: (result: Row) => void) => {
    setBusy(key)
    try {
      const result = await apiPost<Row>(path, body)
      toast.success(result.reason || result.message || 'Action completed')
      onDone?.(result)
      refresh()
      return result
    } catch (error) {
      toast.error(actionError(error))
      return null
    } finally {
      setBusy(null)
    }
  }, [refresh])
  return { busy, run }
}

export function Btn({ children, onClick, disabled, tone = 'default', title, type = 'button' }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'default' | 'primary' | 'danger' | 'ghost'
  title?: string
  type?: 'button' | 'submit'
}) {
  const cls = tone === 'primary'
    ? 'bg-[#009FE3] text-slate-950 hover:bg-[#009FE3]/90'
    : tone === 'danger'
      ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
      : tone === 'ghost'
        ? 'text-slate-400 hover:text-slate-100'
        : 'border-slate-700 text-slate-200 hover:bg-slate-800'
  return (
    <Button type={type} variant="ghost" size="sm" title={title} disabled={disabled} onClick={onClick}
      className={cn('h-8 gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs', cls)}>
      {children}
    </Button>
  )
}

export function Field({ label, value, onChange, placeholder, type = 'text', hint, disabled }: {
  label: string
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-slate-400">{label}</span>
      <input type={type} value={value} disabled={disabled} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} className={INPUT} />
      {hint ? <span className="mt-1 block text-[10px] text-slate-600">{hint}</span> : null}
    </label>
  )
}

export function Select({ label, value, onChange, options, disabled }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-slate-400">{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={INPUT}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function Pill({ status }: { status?: string | null }) {
  return <StatusBadge status={status} />
}

export function JsonBlock({ value, maxHeight = 220 }: { value: unknown; maxHeight?: number }) {
  return (
    <pre className={cn('overflow-auto rounded-md border border-slate-800 bg-slate-950/70 p-3', MONO)}
      style={{ maxHeight }}>
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function Table({ columns, rows, empty = 'No records yet.', onRow }: {
  columns: Array<{ key: string; label: string; render?: (row: Row) => React.ReactNode; width?: string }>
  rows: Row[]
  empty?: string
  onRow?: (row: Row) => void
}) {
  if (!rows.length) return <p className="py-6 text-center text-xs text-slate-500">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
            {columns.map((c) => <th key={c.key} className={cn('px-3 py-2 font-semibold', c.width)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? row.code ?? i)}
              onClick={onRow ? () => onRow(row) : undefined}
              className={cn('border-b border-slate-800/60 text-slate-300', onRow && 'cursor-pointer hover:bg-slate-800/40')}>
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 align-top">
                  {c.render ? c.render(row) : <span className="text-slate-300">{String(row[c.key] ?? '—')}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Panel({ title, description, actions, children, className }: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn(CARD, className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          {description ? <p className="mt-0.5 text-[11px] text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'good'; children: React.ReactNode }) {
  const cls = tone === 'warn'
    ? 'border-amber-500/30 bg-amber-500/5 text-amber-200'
    : tone === 'good'
      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200'
      : 'border-[#009FE3]/30 bg-[#009FE3]/5 text-slate-300'
  return <div className={cn('rounded-md border px-3 py-2 text-[11px] leading-relaxed', cls)}>{children}</div>
}

export function fmtDate(value: unknown): string {
  if (!value) return '—'
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
}

export function short(value: unknown, n = 12): string {
  const s = String(value ?? '')
  return s.length > n ? `${s.slice(0, n)}…` : s
}
