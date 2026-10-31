'use client'

import { useMemo } from 'react'
import { Boxes, Cpu, HardDrive, RefreshCw, Server, XCircle } from 'lucide-react'

import { useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'

// ============================================================
// AI MODEL MANAGEMENT
//
// Three different things, never conflated:
//   catalogue — models the platform is PREPARED to run
//   installed — models actually PRESENT on the local model server
//   providers — the configuration state of every backend
//
// A catalogue entry is a plan. An installed model is a fact.
// ============================================================

type CatalogueEntry = {
  id: string
  label: string
  purpose: string
  parameters: string
  quantisation: string
  ramFootprintMb: number
  license: string
  weightChecksum: string | null
  revision: string | null
  verified: boolean
  acceptableFor: string[]
  notes: string | null
}

type ProviderEntry = {
  kind: string
  state: string
  detail: string
  privateOnly: boolean
  baseUrl: string | null
  chatModel: string | null
  embeddingModel: string | null
}

type ModelsResponse = {
  service: string
  detail: string
  gateway: { enabled: boolean; configured: boolean }
  providers: ProviderEntry[]
  agentProvider: { provider: string; state: string; configured: boolean; detail: string }
  catalogue: CatalogueEntry[]
  installed: Array<{ name: string; sizeBytes?: number; family?: string; parameterSize?: string }>
  installedError: string | null
  counts: { catalogue: number; installed: number }
}

export default function ModelsView() {
  const { data, loading, error, refresh } = useApi<ModelsResponse>('/api/models')
  const providers = data?.providers ?? []
  const catalogue = useMemo(() => data?.catalogue ?? [], [data])

  return (
    <div>
      <PageHeader
        title="AI Model Management"
        description="The private model service: what is prepared to run, what is actually installed, and how each backend is configured."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Refresh model status">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error ? <EmptyState icon={XCircle} title="Model status could not be loaded" description={error} /> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Service" value={data?.service ?? '—'} icon={Server} loading={loading} sub={data?.detail ?? ''} />
        <KpiCard label="Providers" value={providers.length} icon={Cpu} tone="slate" loading={loading} sub="configured backends" />
        <KpiCard label="Catalogue" value={data?.counts.catalogue ?? '—'} icon={Boxes} tone="accent" loading={loading} sub="models prepared to run" />
        <KpiCard
          label="Installed"
          value={data?.counts.installed ?? '—'}
          icon={HardDrive}
          tone={data && data.counts.installed > 0 ? 'green' : 'amber'}
          loading={loading}
          sub="present on the local server"
        />
      </div>

      <div className="mb-4" role="status" aria-label="AI workforce provider status">
        <SectionCard title="AI workforce execution provider" description="Used by Core Agents, the Command Center and website chat. This is separate from the private model service below.">
          <div className={CARD + ' p-4'}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm text-slate-200">{data?.agentProvider.provider ?? 'Checking configuration…'}</span>
              <StatusBadge status={data?.agentProvider.state ?? 'CHECKING'} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{data?.agentProvider.detail ?? 'Reading server configuration without exposing credentials.'}</p>
            <p className="mt-2 text-[11px] text-slate-500">Configuration is not a live health check. Run a read-only agent task to verify the provider. Keys are managed in the server environment, not in the browser.</p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Providers" description="How each backend is configured right now.">
          {loading && !data ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-md bg-slate-800/50" />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <EmptyState icon={Server} title="No model provider is configured" description="Set LOCAL_MODEL_BASE_URL or LOCAL_OPENAI_BASE_URL to enable a private model." />
          ) : (
            <div className="space-y-2">
              {providers.map((provider) => (
                <div key={provider.kind} className={CARD + ' p-3'}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-200">{provider.kind}</span>
                    <StatusBadge status={provider.state} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{provider.detail}</p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {provider.privateOnly ? 'private upstreams only · ' : ''}
                    {provider.baseUrl ?? 'no base URL configured'}
                  </p>
                  {provider.chatModel || provider.embeddingModel ? (
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      chat: {provider.chatModel ?? '—'} · embeddings: {provider.embeddingModel ?? '—'}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Installed on the local server"
          description={
            data?.installedError
              ? `The local model server could not be reached: ${data.installedError}`
              : 'The models the local model server reports it actually has.'
          }
        >
          {data?.installedError ? (
            <EmptyState icon={Server} title="Local model server unreachable" description={data.installedError} />
          ) : (data?.installed.length ?? 0) === 0 && !loading ? (
            <EmptyState
              icon={HardDrive}
              title="No models are installed"
              description="The local model server is reachable but has no models. Pull one on the host, then refresh."
            />
          ) : (
            <div className="space-y-2">
              {data?.installed.map((model) => (
                <div key={model.name} className={CARD + ' flex items-center justify-between p-3'}>
                  <span className="font-mono text-xs text-slate-200">{model.name}</span>
                  <span className="text-[11px] text-slate-500">
                    {model.parameterSize ?? ''}
                    {model.sizeBytes ? ` · ${(model.sizeBytes / 1_000_000_000).toFixed(2)} GB` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard
          title="Model catalogue"
          description="The models the platform is prepared to run on CPU. A model whose weight checksum has not been verified on the host is marked accordingly and is not promotable."
        >
          <div className={CARD + ' overflow-x-auto'}>
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Model</th>
                  <th className="px-3 py-2 font-semibold">Purpose</th>
                  <th className="px-3 py-2 font-semibold">Params</th>
                  <th className="px-3 py-2 font-semibold">RAM</th>
                  <th className="px-3 py-2 font-semibold">Licence</th>
                  <th className="px-3 py-2 font-semibold">Weights verified</th>
                </tr>
              </thead>
              <tbody>
                {catalogue.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-3 py-2">
                      <span className={MONO}>{entry.id}</span>
                      {entry.notes ? <p className="mt-0.5 text-[11px] text-slate-500">{entry.notes}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{entry.purpose}</td>
                    <td className="px-3 py-2 text-slate-400">{entry.parameters}</td>
                    <td className="px-3 py-2 text-slate-400">{entry.ramFootprintMb} MB</td>
                    <td className="px-3 py-2 text-slate-400">{entry.license}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={entry.verified ? 'VERIFIED' : 'UNVERIFIED'} />
                      {entry.weightChecksum ? (
                        <p className={MONO + ' mt-0.5 break-all text-[10px] text-slate-600'}>{entry.weightChecksum}</p>
                      ) : (
                        <p className="mt-0.5 text-[10px] text-amber-500/80">
                          Not verified on this host — run scripts/verify-local-models.mjs
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
