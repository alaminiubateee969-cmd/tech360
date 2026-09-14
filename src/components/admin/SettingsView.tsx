'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Database, Download, ExternalLink, FileArchive, Loader2, Package, RotateCcw, Server, ShieldAlert, TriangleAlert, XCircle } from 'lucide-react'

import { fetchJson, num, prettify, useApi, type HealthResponse } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ENV_DOCS: Array<{ group: string; vars: Array<{ name: string; purpose: string }> }> = [
  {
    group: 'Database & App',
    vars: [
      { name: 'DATABASE_URL', purpose: 'SQLite database file location (server-only)' },
      { name: 'APP_PUBLIC_URL', purpose: 'Public base URL used in preview / handover links' },
      { name: 'ADMIN_PASSWORD', purpose: 'Initial Super Admin password (first boot only)' },
    ],
  },
  {
    group: 'WhatsApp Cloud API',
    vars: [
      { name: 'WHATSAPP_TOKEN', purpose: 'Permanent access token from Meta app' },
      { name: 'WHATSAPP_PHONE_NUMBER_ID', purpose: 'Cloud API phone number id' },
    ],
  },
  {
    group: 'Email (SMTP)',
    vars: [
      { name: 'SMTP_HOST', purpose: 'Relay hostname' },
      { name: 'SMTP_PORT', purpose: 'Relay port (587 typical)' },
      { name: 'SMTP_SECURE', purpose: 'Set to true for TLS-on-connect (465)' },
      { name: 'SMTP_USER', purpose: 'SMTP username' },
      { name: 'SMTP_PASS', purpose: 'SMTP password / app password' },
      { name: 'SMTP_FROM', purpose: 'From address on outbound mail' },
    ],
  },
  {
    group: 'SMS',
    vars: [
      { name: 'SMS_API_URL', purpose: 'SMS gateway endpoint' },
      { name: 'SMS_API_KEY', purpose: 'Gateway bearer token' },
      { name: 'SMS_SENDER', purpose: 'Sender id (defaults to Tech360)' },
    ],
  },
  {
    group: 'Social & Automation',
    vars: [
      { name: 'FACEBOOK_PAGE_TOKEN', purpose: 'Facebook page access token' },
      { name: 'INSTAGRAM_TOKEN', purpose: 'Instagram account token' },
      { name: 'LINKEDIN_TOKEN', purpose: 'LinkedIn API token' },
      { name: 'X_TOKEN', purpose: 'X / Twitter API token' },
      { name: 'N8N_WEBHOOK_BASE', purpose: 'Base URL of your n8n webhook receiver' },
    ],
  },
]

// ------------------------------------------------------------
// Platform Governance — Super Admin feature flags + payment
// gateways backed by GET/PUT/DELETE /api/admin/settings (fetchJson
// attaches the CSRF header on every mutation automatically).
// The server response is always the source of truth: local state is
// an optimistic mirror that re-syncs after every mutation.
// ------------------------------------------------------------

type FlagMap = Record<string, boolean>

interface FlagDefinition {
  key: string
  label: string
  description: string
  affects: string
  default: boolean
}

type GatewayMode = 'SANDBOX' | 'PRODUCTION'
type GatewayStatusKind = 'ACTIVE' | 'CONFIGURATION_REQUIRED' | 'INTEGRATION_NOT_BUILT' | 'DISABLED'
type GatewaySettlement = 'PLATFORM_VERIFIED' | 'GATEWAY_CHECKOUT' | 'MANUAL_VERIFIED'

interface GatewayRow {
  code: string
  name: string
  settlement: GatewaySettlement
  credentialEnvVars?: string[] | null
  supportsWebhook?: boolean
  supportsRefund?: boolean
  instructionsNote?: string | null
  defaultEnabled?: boolean
  enabled: boolean
  mode: GatewayMode
  credentialsConfigured?: boolean
  missingCredentials?: string[] | null
  checkoutBuilt?: boolean
  status: GatewayStatusKind
}

interface SettingsPayload {
  flags?: FlagMap | null
  flagDefinitions?: FlagDefinition[] | null
  gateways?: GatewayRow[] | null
}

interface SettingsMutationResponse {
  ok?: boolean
  changed?: string[]
  flags?: FlagMap | null
  gateways?: GatewayRow[] | null
}

/** Super-Admin guard rejects non-super-admins with 403 "Insufficient permissions". */
const GOVERNANCE_FORBIDDEN_RE = /insufficient permissions|forbidden|\b403\b/i

const GATEWAY_STATUS_TONE: Record<GatewayStatusKind, string> = {
  ACTIVE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  CONFIGURATION_REQUIRED: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  INTEGRATION_NOT_BUILT: 'border-slate-600/40 bg-slate-700/20 text-slate-400',
  DISABLED: 'border-red-500/30 bg-red-500/10 text-red-400',
}

const GATEWAY_STATUS_TITLE: Record<GatewayStatusKind, string> = {
  ACTIVE: 'Enabled, credentials live, checkout built — accepted as a payment method.',
  CONFIGURATION_REQUIRED: 'Enabled but credentials are missing in the environment — the backend rejects it until configured.',
  INTEGRATION_NOT_BUILT: 'Enabled but the checkout integration does not exist yet — never treated as processing payments.',
  DISABLED: 'Disabled by Super Admin — rejected by the backend and never shown as accepted.',
}

const SETTLEMENT_LABEL: Record<GatewaySettlement, string> = {
  PLATFORM_VERIFIED: 'Platform-verified',
  GATEWAY_CHECKOUT: 'Online checkout',
  MANUAL_VERIFIED: 'Manually verified',
}

const SETTLEMENT_TITLE: Record<GatewaySettlement, string> = {
  PLATFORM_VERIFIED: 'Client pays externally and submits proof — the platform verifies and issues the receipt.',
  GATEWAY_CHECKOUT: 'Server-side checkout session with webhook verification.',
  MANUAL_VERIFIED: 'Recorded and verified manually with a transaction reference.',
}

/** Mirrors the server-side status computation so optimistic flips stay honest. */
function gatewayStatusAfter(row: GatewayRow, enabled: boolean): GatewayStatusKind {
  if (!enabled) return 'DISABLED'
  if (row.settlement === 'GATEWAY_CHECKOUT' && row.checkoutBuilt === false) return 'INTEGRATION_NOT_BUILT'
  const envVars = row.credentialEnvVars ?? []
  const missing = row.missingCredentials ?? []
  if (envVars.length > 0 && missing.length > 0) return 'CONFIGURATION_REQUIRED'
  return 'ACTIVE'
}

function GovernanceAlert({ error }: { error: string }) {
  return (
    <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
      Governance API failed: {error}
    </div>
  )
}

function PlatformGovernance() {
  const { data, loading, error } = useApi<SettingsPayload>('/api/admin/settings')
  const [flags, setFlags] = useState<FlagMap | null>(null)
  const [gateways, setGateways] = useState<GatewayRow[] | null>(null)
  const [busyFlag, setBusyFlag] = useState<string | null>(null)
  const [busyGateway, setBusyGateway] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  // Server is the source of truth — mirror the GET payload in local state.
  useEffect(() => {
    if (!data) return
    setFlags({ ...(data.flags ?? {}) })
    setGateways((data.gateways ?? []).map((g) => ({ ...g })))
  }, [data])

  const forbidden = error !== null && GOVERNANCE_FORBIDDEN_RE.test(error)
  const syncing = loading || (data !== null && (flags === null || gateways === null))

  const flagDefs = useMemo<FlagDefinition[]>(() => {
    if (data?.flagDefinitions && data.flagDefinitions.length > 0) return data.flagDefinitions
    return Object.keys(flags ?? {}).map((key) => ({ key, label: prettify(key), description: '', affects: '', default: true }))
  }, [data, flags])

  async function putFlag(key: string, next: boolean) {
    if (!flags) return
    const prev = Boolean(flags[key])
    if (prev === next) return
    setBusyFlag(key)
    setFlags({ ...flags, [key]: next }) // optimistic flip
    try {
      const res = await fetchJson<SettingsMutationResponse>('/api/admin/settings', {
        method: 'PUT',
        body: { flags: { [key]: next } },
      })
      if (res.flags) setFlags(res.flags) // re-sync from the server response
      toast.success(res.changed && res.changed.length > 0 ? res.changed.join(' · ') : `flag ${key}=${next ? 'ON' : 'OFF'}`)
    } catch (err) {
      setFlags((f) => (f ? { ...f, [key]: prev } : f)) // revert on error
      toast.error(err instanceof Error ? err.message : 'Update failed — switch reverted.')
    } finally {
      setBusyFlag(null)
    }
  }

  async function putGateway(code: string, patch: { enabled?: boolean; mode?: GatewayMode }) {
    if (!gateways) return
    const row = gateways.find((g) => g.code === code)
    if (!row) return
    const prev = { enabled: row.enabled, mode: row.mode }
    if (patch.enabled !== undefined && patch.mode === undefined && patch.enabled === prev.enabled) return
    if (patch.mode !== undefined && patch.enabled === undefined && patch.mode === prev.mode) return
    setBusyGateway(code)
    setGateways(gateways.map((g) => {
      if (g.code !== code) return g
      const enabled = patch.enabled ?? g.enabled
      const mode = patch.mode ?? g.mode
      return { ...g, enabled, mode, status: gatewayStatusAfter(g, enabled) }
    })) // optimistic flip
    try {
      const res = await fetchJson<SettingsMutationResponse>('/api/admin/settings', {
        method: 'PUT',
        body: { gateways: { [code]: patch } },
      })
      if (res.gateways) setGateways(res.gateways) // re-sync from the server response
      toast.success(res.changed && res.changed.length > 0 ? res.changed.join(' · ') : `gateway ${code} updated`)
    } catch (err) {
      setGateways((gs) =>
        gs ? gs.map((g) => (g.code === code ? { ...g, enabled: prev.enabled, mode: prev.mode, status: gatewayStatusAfter(g, prev.enabled) } : g)) : gs,
      ) // revert on error
      toast.error(err instanceof Error ? err.message : 'Update failed — switch reverted.')
    } finally {
      setBusyGateway(null)
    }
  }

  async function resetFlagDefaults() {
    if (resetting) return
    if (!window.confirm('Reset all feature flags to their platform defaults? Payment gateway settings are kept.')) return
    setResetting(true)
    try {
      const res = await fetchJson<SettingsMutationResponse>('/api/admin/settings', { method: 'DELETE' })
      if (res.flags) setFlags(res.flags)
      toast.success('Feature flags reset to platform defaults.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed.')
    } finally {
      setResetting(false)
    }
  }

  const forbiddenState = (
    <EmptyState
      icon={ShieldAlert}
      title="Super Admin only"
      description="These switches control live platform behavior. Ask a Super Admin to change them."
    />
  )

  return (
    <>
      <SectionCard
        title="Feature Management"
        description="Super Admin switches — changes take effect on the live backend immediately."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void resetFlagDefaults()}
            disabled={resetting || syncing || forbidden || error !== null || !flags}
            className="border-slate-700 bg-slate-950/60 text-slate-300 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300"
          >
            {resetting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-3.5" aria-hidden="true" />}
            Reset to defaults
          </Button>
        }
      >
        {syncing ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className={cn('h-16 w-full bg-slate-800/50', i === 0 ? 'md:col-span-2' : '')} />
            ))}
          </div>
        ) : forbidden ? (
          forbiddenState
        ) : error ? (
          <GovernanceAlert error={error} />
        ) : flagDefs.length === 0 ? (
          <EmptyState title="No feature flags reported" description="The governance API returned no feature flag definitions." />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2" role="list" aria-label="Platform feature flags">
            {flagDefs.map((def) => {
              const maintenance = def.key === 'maintenance_mode'
              const on = Boolean(flags?.[def.key])
              return (
                <div
                  key={def.key}
                  role="listitem"
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-md border bg-slate-950/50 px-3 py-2.5',
                    maintenance ? 'border-amber-500/40 bg-amber-500/5 md:col-span-2' : 'border-slate-800/70',
                  )}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <p className={cn('flex items-center gap-1.5 text-[13px] font-medium', maintenance ? 'text-amber-300' : 'text-slate-200')}>
                      {maintenance ? <TriangleAlert className="size-3.5 shrink-0 text-amber-400" aria-hidden="true" /> : null}
                      {def.label}
                    </p>
                    {def.description ? <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{def.description}</p> : null}
                    {def.affects ? (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600" title={def.affects}>
                        affects {def.affects}
                      </p>
                    ) : null}
                    {maintenance && on ? (
                      <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-400">
                        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        Public data APIs return 503 with a maintenance notice. Admin APIs stay live.
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    checked={on}
                    onCheckedChange={(v) => void putFlag(def.key, v)}
                    disabled={busyFlag === def.key}
                    aria-label={`${def.label} ${on ? 'on' : 'off'}`}
                    className={maintenance ? 'data-[state=checked]:bg-amber-500' : 'data-[state=checked]:bg-emerald-500'}
                  />
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Payment Gateways"
        description="Live payment methods — disabled gateways are rejected by the backend and never shown as accepted."
      >
        {syncing ? (
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-slate-800/50" />
            ))}
          </div>
        ) : forbidden ? (
          forbiddenState
        ) : error ? (
          <GovernanceAlert error={error} />
        ) : (gateways ?? []).length === 0 ? (
          <EmptyState title="No payment gateways reported" description="The governance API returned no gateway statuses." />
        ) : (
          <ul className="space-y-2" role="list" aria-label="Payment gateways">
            {(gateways ?? []).map((g) => {
              const busy = busyGateway === g.code
              const missing = g.missingCredentials ?? []
              return (
                <li key={g.code} role="listitem" className="rounded-md border border-slate-800/70 bg-slate-950/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-200">{g.name}</p>
                    <StatusBadge status={g.status} title={GATEWAY_STATUS_TITLE[g.status]} className={GATEWAY_STATUS_TONE[g.status]} />
                    <span
                      title={SETTLEMENT_TITLE[g.settlement] ?? g.settlement}
                      className="inline-flex items-center whitespace-nowrap rounded-md border border-slate-700/60 bg-slate-800/30 px-2 py-0.5 text-[10px] font-medium text-slate-400"
                    >
                      {SETTLEMENT_LABEL[g.settlement] ?? prettify(g.settlement)}
                    </span>
                    {g.supportsWebhook ? (
                      <span
                        title="Verified server-side webhooks"
                        className="inline-flex items-center whitespace-nowrap rounded-md border border-slate-700/60 bg-slate-800/30 px-1.5 py-0.5 text-[10px] text-slate-400"
                      >
                        Webhooks
                      </span>
                    ) : null}
                    {g.supportsRefund ? (
                      <span
                        title="Refund support"
                        className="inline-flex items-center whitespace-nowrap rounded-md border border-slate-700/60 bg-slate-800/30 px-1.5 py-0.5 text-[10px] text-slate-400"
                      >
                        Refunds
                      </span>
                    ) : null}
                    <div className="ml-auto flex flex-wrap items-center gap-2.5">
                      <div className="inline-flex overflow-hidden rounded-md border border-slate-800 bg-slate-950/60" role="group" aria-label={`${g.name} mode`}>
                        {(['SANDBOX', 'PRODUCTION'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            disabled={busy}
                            aria-pressed={g.mode === m}
                            onClick={() => void putGateway(g.code, { mode: m })}
                            className={cn(
                              'px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-40',
                              g.mode === m ? 'bg-[#009FE3]/15 text-[#009FE3]' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300',
                            )}
                          >
                            {m === 'SANDBOX' ? 'Sandbox' : 'Production'}
                          </button>
                        ))}
                      </div>
                      <Switch
                        checked={g.enabled}
                        onCheckedChange={(v) => void putGateway(g.code, { enabled: v })}
                        disabled={busy}
                        aria-label={`${g.name} ${g.enabled ? 'enabled' : 'disabled'}`}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  </div>
                  {g.status === 'CONFIGURATION_REQUIRED' && missing.length > 0 ? (
                    <p className="mt-1.5 text-[11px] text-amber-400">Credentials missing: {missing.join(', ')}</p>
                  ) : null}
                  {g.status === 'INTEGRATION_NOT_BUILT' ? (
                    <p className="mt-1.5 text-[11px] font-medium text-slate-400">Checkout integration not implemented — switch stored, integration pending.</p>
                  ) : null}
                  {g.instructionsNote ? <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{g.instructionsNote}</p> : null}
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </>
  )
}

export function SettingsView() {
  const { data, loading, error } = useApi<HealthResponse>('/api/health')

  const dbOk = data?.db === true || data?.db === 'true' || (data?.db ?? '').toString().toUpperCase() === 'OK'
  const channels = Object.entries(data?.channels ?? {})

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Settings"
        description="Live system status and deployment configuration. Environment variables are read-only server-side; the Platform Governance switches below are live Super Admin controls."
      />

      {/* Platform governance — feature flags + payment gateways (Super Admin) */}
      <PlatformGovernance />

      {error ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          Health check failed: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 w-full bg-slate-800/50" />
          <Skeleton className="h-24 w-full bg-slate-800/50" />
          <Skeleton className="h-24 w-full bg-slate-800/50" />
        </div>
      ) : (
        <section aria-label="System status" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Database"
            value={dbOk ? 'Operational' : (data?.db ?? 'Unknown')}
            icon={Database}
            tone={dbOk ? 'green' : 'red'}
            sub={data?.db ? 'SQLite via Prisma' : 'Status not reported'}
          />
          <KpiCard label="AI Agents" value={num(data?.agents)} icon={Server} tone="accent" sub="Registered in the workforce" />
          <KpiCard
            label="API Status"
            value={prettify(data?.status ?? '—')}
            icon={CheckCircle2}
            tone={(data?.status ?? '').toUpperCase() === 'OK' ? 'green' : 'amber'}
            sub={data?.version ? `Version ${data.version}` : 'Version not reported'}
          />
        </section>
      )}

      <SectionCard
        title="Channel Configuration"
        description="Exactly as reported by /api/health — channels without credentials report NOT_CONFIGURED and cannot send."
      >
        {loading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-40 bg-slate-800/60" />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <EmptyState title="No channel statuses reported" description="The health endpoint did not include channel configuration." />
        ) : (
          <div className="flex flex-wrap gap-2" role="list" aria-label="Channel configuration">
            {channels.map(([name, state]) => {
              const s = String(state ?? '').toUpperCase()
              const ok = s === 'CONFIGURED' || s === 'TRUE' || s === 'OK'
              const cls = ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : s === 'FAILED' || s === 'FALSE'
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              return (
                <span
                  key={name}
                  role="listitem"
                  title={ok ? 'Credentials configured' : 'Not configured — set env credentials to enable this channel.'}
                  className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium', cls)}
                >
                  {ok ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <XCircle className="size-3.5" aria-hidden="true" />}
                  {prettify(name)}
                  <span className="opacity-60">·</span>
                  {ok ? 'Configured' : s === 'FAILED' ? 'Failed' : 'Not Configured'}
                </span>
              )
            })}
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Required Environment Variables" description="Names only — values never leave the server" className="xl:col-span-2">
          <div className="space-y-4">
            {ENV_DOCS.map((g) => (
              <div key={g.group}>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.group}</h3>
                <ul className="space-y-1">
                  {g.vars.map((v) => (
                    <li key={v.name} className="flex flex-col gap-0.5 rounded-md border border-slate-800/70 bg-slate-950/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <code className="font-mono text-xs text-[#009FE3]">{v.name}</code>
                      <span className="text-[11px] text-slate-500">{v.purpose}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-md border border-slate-800 bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-500">
            Secrets are read server-side only. The admin console displays configuration status (configured or not) —
            never values. Restart the app after updating environment variables.
          </p>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Deployment Package" description="Self-contained production bundle">
            <a
              href="/api/admin/deploy-package"
              download
              className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-[#009FE3]/50 hover:bg-[#009FE3]/10 hover:text-[#009FE3] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#009FE3]/50"
              aria-label="Download deployment package (zip)"
            >
              <Package className="size-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                Download Deployment Package
                <span className="block text-[11px] font-normal text-slate-500">ZIP — server bundle + n8n workflows + env template</span>
              </span>
              <Download className="size-4 shrink-0" aria-hidden="true" />
            </a>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              The package contains the deployment bundle, workflow definitions, and an .env template listing every
              variable above (no values included).
            </p>
          </SectionCard>

          <SectionCard title="Full Project Source" description="Owner master copy — every project file">
            <a
              href="/downloads/tech360-platform-full-source.zip"
              download
              className="flex items-center gap-3 rounded-md border border-emerald-700/50 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 transition-colors hover:border-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/60"
              aria-label="Download full project source archive (zip)"
            >
              <FileArchive className="size-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                Download Full Project Source
                <span className="block text-[11px] font-normal text-slate-500">ZIP · 479 files · 21 MB · src, prisma + db, mini-services, deployment, n8n, brand assets, docs</span>
              </span>
              <Download className="size-4 shrink-0" aria-hidden="true" />
            </a>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              The owner&apos;s complete master archive: application source, database with live data, autonomous ops
              services, Cloud Run deployment, n8n workflows, the shared company pad &amp; logo (public/brand), the
              official letterhead engine (src/lib/letterhead.ts), and the full build log (worklog.md). The real
              .env is excluded for security — .env.example documents every variable. Client-facing source delivery
              stays gated by the platform&apos;s two payment gates.
            </p>
          </SectionCard>

          <SectionCard title="Legal & Policies" description="Public documentation">
            <ul className="space-y-2">
              {[
                ['#/legal/privacy', 'Privacy Policy'],
                ['#/legal/terms', 'Terms of Service'],
                ['#/legal/refund', 'Refund Policy'],
              ].map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-[13px] text-slate-300 transition-colors hover:border-[#009FE3]/50 hover:text-[#009FE3]"
                  >
                    {label}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </SectionCard>

          <div className={cn(CARD, 'p-4')}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Session Security</h3>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-500">
              <li>Sessions: HttpOnly cookie `t360_session` (12h TTL)</li>
              <li>Mutations: `x-csrf-token` echo of `t360_csrf` cookie</li>
              <li>Passwords: scrypt hashed, forced rotation on first login</li>
              <li>All admin actions audit-logged with actor and IP</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="pb-2 text-center text-[11px] text-slate-700">
        <StatusBadge status={dbOk ? 'OPERATIONAL' : 'FAILED'} /> — health polled from /api/health on view load
      </p>
    </div>
  )
}
