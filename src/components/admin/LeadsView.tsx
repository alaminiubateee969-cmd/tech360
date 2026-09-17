'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, RefreshCw, Search } from 'lucide-react'

import { fmtDateShort, useApi, type ClientsResponse } from '@/lib/admin-client'
import { DataTable, type Column } from './shared/DataTable'
import { EmptyState, PageHeader } from './shared/cards'
import { Pager } from './shared/Pager'
import { StatusBadge } from './shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const STAGES = [
  'NEW', 'CONTACTED', 'BUSINESS_IDENTIFIED', 'PLAN_RECOMMENDED', 'SCOPE_COLLECTION',
  'SCOPE_REVIEW', 'FINAL_SCOPE', 'CLIENT_APPROVAL', 'PAYMENT_PENDING', 'PROJECT_ACTIVE',
  'DEVELOPMENT', 'CLIENT_REVIEW', 'FINAL_PAYMENT', 'DELIVERY', 'HANDOVER',
  'PASSWORD_CHANGE', 'REVIEW_REQUESTED', 'REFERRAL_REQUESTED', 'COMPLETED', 'CLOSED',
] as const

const STATUSES = ['LEAD', 'CLIENT', 'ACTIVE', 'COMPLETED', 'CLOSED', 'LOST'] as const

const PAGE_SIZE = 20

const pretty = (s: string) =>
  s
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

export function LeadsView({
  mode,
  onOpenClient,
  initialQuery = '',
}: {
  mode: 'leads' | 'clients'
  onOpenClient: (id: string) => void
  initialQuery?: string
}) {
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [stage, setStage] = useState<string>('ALL')
  const [status, setStatus] = useState<string>(mode === 'leads' ? 'LEAD' : 'ALL')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(input)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [input])

  const url = useMemo(() => {
    const p = new URLSearchParams()
    if (query.trim()) p.set('query', query.trim())
    if (stage !== 'ALL') p.set('stage', stage)
    if (status !== 'ALL') p.set('status', status)
    p.set('page', String(page))
    return `/api/admin/clients?${p.toString()}`
  }, [query, stage, status, page])

  const { data, loading, error, refresh } = useApi<ClientsResponse>(url)
  const rows = data?.clients ?? []
  const total = data?.total ?? 0

  const columns: Column<ClientsResponse['clients'][number]>[] = [
    {
      key: 'clientId',
      header: 'Client ID',
      cell: (r) => <span className="font-mono text-xs text-[#009FE3]">{r.clientId}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      cell: (r) => <span className="font-medium text-slate-200">{r.name}</span>,
    },
    { key: 'business', header: 'Business', cell: (r) => <span className="text-slate-400">{r.businessName || '—'}</span> },
    { key: 'type', header: 'Type', cell: (r) => <span className="text-slate-400">{r.businessType || '—'}</span> },
    { key: 'source', header: 'Source', cell: (r) => <span className="text-xs text-slate-500">{r.source || '—'}</span> },
    { key: 'stage', header: 'Stage', cell: (r) => <StatusBadge status={r.pipelineStage} /> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'created', header: 'Created', cell: (r) => <span className="text-xs text-slate-500">{fmtDateShort(r.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      className: 'w-16 text-right',
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-[#009FE3] hover:bg-[#009FE3]/10 hover:text-[#009FE3]"
          onClick={(e) => {
            e.stopPropagation()
            onOpenClient(r.id)
          }}
          aria-label={`View client ${r.clientId}`}
        >
          <Eye className="size-3.5" aria-hidden="true" /> View
        </Button>
      ),
    },
  ]

  const isLeads = mode === 'leads'
  return (
    <div>
      <PageHeader
        title={isLeads ? 'Leads' : 'Clients'}
        description={
          isLeads
            ? 'Inquiries captured from website, WhatsApp, email and other channels — the front of the 20-stage journey.'
            : 'Every record with a TECH-YYYY-NNNNNN Client ID, from first message to closure.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isLeads ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/api/admin/leads/export', '_blank', 'noopener')}
                className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                aria-label="Export leads as CSV"
                title="Download every non-deleted lead/client as CSV (guard-protected)"
              >
                <Download className="size-4" aria-hidden="true" /> Export CSV
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
              aria-label="Refresh list"
            >
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
          <Input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isLeads ? 'Search leads by name, business, ID…' : 'Search clients…'}
            aria-label="Search records"
            className="h-9 border-slate-800 bg-slate-950/60 pl-9 text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <div>
          <label htmlFor="stage-filter" className="sr-only">
            Filter by pipeline stage
          </label>
          <Select value={stage} onValueChange={(v) => { setStage(v); setPage(1) }}>
            <SelectTrigger id="stage-filter" className="h-9 w-full border-slate-800 bg-slate-950/60 text-slate-200 sm:w-[200px]">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
              <SelectItem value="ALL">All stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {pretty(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger id="status-filter" className="h-9 w-full border-slate-800 bg-slate-950/60 text-slate-200 sm:w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {pretty(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Could not load records: {error}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        onRowClick={(r) => onOpenClient(r.id)}
        empty={
          <EmptyState
            title={query || stage !== 'ALL' || status !== 'ALL' ? 'No records match these filters' : isLeads ? 'No leads yet' : 'No clients yet'}
            description={
              query || stage !== 'ALL' || status !== 'ALL'
                ? 'Try clearing the search or filters.'
                : 'New inquiries will appear here.'
            }
          />
        }
        aria-label={isLeads ? 'Leads table' : 'Clients table'}
      />

      <Pager page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} loading={loading} unit="records" />
    </div>
  )
}
