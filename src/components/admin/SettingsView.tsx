'use client'

import { CheckCircle2, Database, Download, ExternalLink, Package, Server, XCircle } from 'lucide-react'

import { num, prettify, useApi, type HealthResponse } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD } from './shared/styles'
import { Skeleton } from '@/components/ui/skeleton'
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

export function SettingsView() {
  const { data, loading, error } = useApi<HealthResponse>('/api/health')

  const dbOk = data?.db === true || data?.db === 'true' || (data?.db ?? '').toString().toUpperCase() === 'OK'
  const channels = Object.entries(data?.channels ?? {})

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Settings"
        description="Live system status and deployment configuration. Read-only — configuration lives in server environment variables, never in the browser."
      />

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
