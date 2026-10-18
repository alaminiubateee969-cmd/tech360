'use client'

import { RefreshCw, Plug, XCircle } from 'lucide-react'

import { useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD } from './shared/styles'
import { Button } from '@/components/ui/button'

// ============================================================
// CRM INTEGRATIONS
//
// The real state of every outbound integration. A channel without
// credentials is reported NOT_CONFIGURED — the platform refuses to
// pretend it can send.
// ============================================================

type Integration = {
  id: string
  name: string
  category: 'MESSAGING' | 'CRM' | 'AUTOMATION' | 'AI' | 'PAYMENTS' | 'STORAGE'
  state: 'CONFIGURED' | 'NOT_CONFIGURED' | 'DISABLED_BY_ADMIN' | 'NOT_BUILT'
  detail: string
  adminSwitch: string | null
}

type IntegrationsResponse = {
  integrations: Integration[]
  summary: { total: number; configured: number; notConfigured: number; disabled: number; notBuilt: number }
}

const CATEGORIES = ['MESSAGING', 'CRM', 'AUTOMATION', 'AI', 'PAYMENTS', 'STORAGE'] as const

export default function IntegrationsView() {
  const { data, loading, error, refresh } = useApi<IntegrationsResponse>('/api/admin/integrations')

  return (
    <div>
      <PageHeader
        title="CRM Integrations"
        description="What each outbound channel is configured to do right now. Credentials are never displayed, and a channel that is not configured is never reported as working."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh integration status">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error ? <EmptyState icon={XCircle} title="Integration status could not be loaded" description={error} /> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Configured" value={data?.summary.configured ?? '—'} icon={Plug} tone="green" loading={loading} sub="ready to use" />
        <KpiCard label="Not configured" value={data?.summary.notConfigured ?? '—'} icon={Plug} tone="amber" loading={loading} sub="sends are refused" />
        <KpiCard label="Disabled" value={data?.summary.disabled ?? '—'} icon={Plug} tone="slate" loading={loading} sub="switched off in the console" />
        <KpiCard label="Total" value={data?.summary.total ?? '—'} icon={Plug} tone="accent" loading={loading} sub="tracked integrations" />
      </div>

      {CATEGORIES.map((category) => {
        const rows = (data?.integrations ?? []).filter((i) => i.category === category)
        if (rows.length === 0) return null
        return (
          <div key={category} className="mb-4">
            <SectionCard title={category} description={`${rows.length} integration(s)`}>
              <div className="grid gap-2 md:grid-cols-2">
                {rows.map((integration) => (
                  <div key={integration.id} className={CARD + ' p-3'}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-200">{integration.name}</span>
                      <StatusBadge status={integration.state} />
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{integration.detail}</p>
                    {integration.adminSwitch ? (
                      <p className="mt-1 text-[10px] text-slate-600">Console switch: {integration.adminSwitch}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )
      })}
    </div>
  )
}
