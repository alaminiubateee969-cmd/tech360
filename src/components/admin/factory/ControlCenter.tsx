'use client'

/** Software Factory Control Center — the operator surface for the control plane. */
import { useCallback, useState } from 'react'
import {
  Activity, Boxes, Building2, DatabaseBackup, FileCode2, GitBranch, Layers,
  ListChecks, Plug, RefreshCw, Rocket, ShieldCheck, Sparkles, Users, Workflow,
} from 'lucide-react'
import { PageHeader } from '@/components/admin/shared/cards'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import {
  ApplicationsPanel, BackupsPanel, CompaniesPanel, CustomerAdminPanel, DeploymentsPanel,
  DocsPanel, EngineeringPanel, IntegrationsPanel, JobsPanel, ModulesPanel,
  MonitoringPanel, OverviewPanel, ReleasesPanel, SecurityPanel, TemplatesPanel,
} from './Panels'
import { Btn, Notice } from './shared'

type PanelComponent = (props: { tick: number; reloadAll: () => void; role: string }) => React.ReactNode

const TABS: Array<{ id: string; label: string; icon: LucideIcon; Component: PanelComponent; group: string }> = [
  { id: 'overview', label: 'Control Center', icon: Sparkles, Component: OverviewPanel, group: 'Factory' },
  { id: 'companies', label: 'Company Registry', icon: Building2, Component: CompaniesPanel, group: 'Factory' },
  { id: 'templates', label: 'Template Library', icon: Layers, Component: TemplatesPanel, group: 'Library' },
  { id: 'modules', label: 'Module Library', icon: Boxes, Component: ModulesPanel, group: 'Library' },
  { id: 'applications', label: 'Application Factory', icon: Workflow, Component: ApplicationsPanel, group: 'Build & deploy' },
  { id: 'queue', label: 'Provisioning Queue', icon: ListChecks, Component: JobsPanel, group: 'Build & deploy' },
  { id: 'deployments', label: 'Deployment Center', icon: Rocket, Component: DeploymentsPanel, group: 'Build & deploy' },
  { id: 'releases', label: 'Release Management', icon: GitBranch, Component: ReleasesPanel, group: 'Build & deploy' },
  { id: 'integrations', label: 'Integration Hub', icon: Plug, Component: IntegrationsPanel, group: 'Operate' },
  { id: 'monitoring', label: 'Monitoring & Alerts', icon: Activity, Component: MonitoringPanel, group: 'Operate' },
  { id: 'security', label: 'Security & Audit Center', icon: ShieldCheck, Component: SecurityPanel, group: 'Operate' },
  { id: 'backups', label: 'Backup & Recovery', icon: DatabaseBackup, Component: BackupsPanel, group: 'Operate' },
  { id: 'engineering', label: 'Engineering Workspace', icon: FileCode2, Component: EngineeringPanel, group: 'Governance' },
  { id: 'customers', label: 'Customer Administration', icon: Users, Component: CustomerAdminPanel, group: 'Governance' },
  { id: 'docs', label: 'Documentation & Help', icon: FileCode2, Component: DocsPanel, group: 'Governance' },
]

export function ControlCenter({ role = 'ADMIN' }: { role?: string }) {
  const [tab, setTab] = useState('overview')
  const [tick, setTick] = useState(0)
  const reloadAll = useCallback(() => setTick((t) => t + 1), [])
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  const Panel = current.Component
  const groups = [...new Set(TABS.map((t) => t.group))]
  return (
    <div>
      <PageHeader title="Software Factory Control Center"
        description="Private, self-hosted control plane for company-in-a-box applications. Every status, count and action on this page reads or writes the real control-plane database."
        actions={<Btn onClick={reloadAll}><RefreshCw className="size-3.5" /> Refresh</Btn>} />
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Control Center sections" className="flex gap-1 overflow-x-auto lg:block lg:space-y-4 lg:overflow-visible">
          {groups.map((group) => (
            <div key={group} className="flex shrink-0 gap-1 lg:block lg:space-y-0.5">
              <p className="hidden px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 lg:block">{group}</p>
              {TABS.filter((t) => t.group === group).map((t) => {
                const Icon = t.icon
                const active = t.id === tab
                return (
                  <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={active ? 'page' : undefined}
                    className={cn('flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-[12px] font-medium transition-colors lg:w-full',
                      active ? 'bg-[#009FE3]/15 text-[#009FE3]' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200')}>
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">{t.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">
          {current.id === 'security' && role !== 'SUPER_ADMIN' ? (
            <Notice tone="warn">The global security and audit view requires a SUPER_ADMIN session. Company-scoped audit history is available with an explicit company grant.</Notice>
          ) : null}
          <div key={current.id}>
            <Panel tick={tick} reloadAll={reloadAll} role={role} />
          </div>
        </div>
      </div>
    </div>
  )
}
