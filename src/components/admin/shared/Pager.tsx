'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SCROLL_THIN } from './styles'
import { useApi, type ClientRow } from '@/lib/admin-client'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function Pager({
  page,
  total,
  pageSize = 20,
  onPage,
  loading = false,
  unit = 'records',
}: {
  page: number
  total: number
  pageSize?: number
  onPage: (page: number) => void
  loading?: boolean
  unit?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <p className="text-xs text-slate-500" aria-live="polite">
        {loading ? 'Loading…' : `${from}–${to} of ${total} ${unit}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
          disabled={loading || page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-xs tabular-nums text-slate-400">
          Page {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
          disabled={loading || page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/** Searchable client selector backed by /api/admin/clients (real results only). */
export function ClientPicker({
  value,
  onChange,
  label,
}: {
  value: ClientRow | null
  onChange: (c: ClientRow | null) => void
  label?: string
}) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])
  const url = debounced === null ? null : `/api/admin/clients?query=${encodeURIComponent(debounced)}&page=1`
  const { data, loading } = useApi<{ clients?: ClientRow[] }>(url)
  const results = (data?.clients ?? []).slice(0, 10)
  return (
    <div className="space-y-1.5" role="group" aria-label={label ?? 'Select client'}>
      {label ? <span className="text-xs font-medium text-slate-400">{label}</span> : null}
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-200">{value.name}</p>
            <p className="font-mono text-[11px] text-slate-500">{value.clientId}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-slate-400 hover:text-red-400"
            onClick={() => {
              onChange(null)
              setQ('')
              setDebounced(null)
            }}
          >
            Clear
          </Button>
        </div>
      ) : (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients by name, business, or ID…"
          aria-label="Search clients"
          className="h-9 w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:border-[#009FE3]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/40"
        />
      )}
      {!value && debounced !== null ? (
        <div
          className={cn('max-h-48 overflow-auto rounded-md border border-slate-800 bg-slate-950/60 p-1', SCROLL_THIN)}
          role="listbox"
          aria-label="Client search results"
        >
          {loading ? (
            <div className="space-y-1 p-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full bg-slate-800/70" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-2 py-3 text-xs text-slate-500">No clients match this search.</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-slate-800/60 focus-visible:bg-slate-800/60 focus-visible:outline-none"
                onClick={() => onChange(c)}
              >
                <span className="truncate text-sm text-slate-200">{c.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-slate-500">{c.clientId}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
