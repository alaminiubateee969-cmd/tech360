'use client'

/** The thirteen real control-center panels. Every control calls a live API. */
import { useState } from 'react'
import {
  Activity, AlertTriangle, Boxes, Building2, DatabaseBackup, FileCode2, GitBranch,
  Layers, ListChecks, Plug, RefreshCw, ShieldCheck, Sparkles, Workflow,
} from 'lucide-react'
import { Btn, Field, JsonBlock, Notice, Panel, Pill, Select, Table, apiPatch, apiPost, fmtDate, short, useAction, useEndpoint, type Row } from './shared'
import { Wizard } from './Wizard'

type PanelProps = { tick: number; reloadAll: () => void; role: string }

const STATUS_OPTIONS = ['DRAFT', 'VALIDATED', 'PROVISIONING', 'TEST_FAILED', 'STAGING', 'AWAITING_APPROVAL', 'LIVE', 'DEGRADED', 'ROLLED_BACK', 'RETIRED']

/* ------------------------------------------------------------------ 1. Overview */
export function OverviewPanel({ tick, reloadAll }: PanelProps) {
  const { data, error, loading } = useEndpoint<Row>('/api/factory/overview', tick)
  const { busy, run } = useAction(reloadAll)
  if (error) return <Notice tone="warn">{error}</Notice>
  const counts = data?.counts ?? {}
  const kpis: Array<[string, number | string, string]> = [
    ['Companies', counts.companies ?? '—', 'Registry identities'],
    ['Applications', counts.applications ?? '—', 'Provisioned instances'],
    ['Templates', counts.templates ?? '—', `${counts.productionReadyTemplates ?? 0} production-ready`],
    ['Shared modules', counts.modules ?? '—', `${counts.templateModuleLinks ?? 0} template links`],
    ['Provisioning jobs', counts.jobs ?? '—', 'Real queue'],
    ['Verified backups', counts.verifiedBackups ?? '—', `of ${counts.backups ?? 0} created`],
    ['Integrations', counts.integrations ?? '—', 'Adapter records'],
    ['Audit events', counts.auditEvents ?? '—', 'Allow + deny'],
  ]
  return (
    <div className="space-y-4">
      {!data?.catalogInitialized ? (
        <Panel title="Initialize the private library" description="No approved templates or modules exist yet.">
          <Notice tone="warn">A template is marked production-ready only after its module composition, dependencies and checks actually pass. Initialize the library to create the initial approved assets.</Notice>
          <div className="mt-3"><Btn tone="primary" disabled={busy === 'bootstrap'} onClick={() => run('bootstrap', '/api/factory/bootstrap', {})}>Initialize private template &amp; module library</Btn></div>
        </Panel>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">{loading ? '…' : value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Application lifecycle (real state)" description="Grouped from the application table, not a placeholder metric.">
          <div className="flex flex-wrap gap-2">
            {Object.entries(data?.applicationStatuses ?? {}).map(([k, v]) => <span key={k} className="rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-300"><Pill status={k} /> <span className="ml-1 font-semibold">{String(v)}</span></span>)}
            {!Object.keys(data?.applicationStatuses ?? {}).length ? <p className="text-xs text-slate-500">No applications provisioned yet.</p> : null}
          </div>
        </Panel>
        <Panel title="Integration health (real state)">
          <div className="flex flex-wrap gap-2">
            {Object.entries(data?.integrationStatuses ?? {}).map(([k, v]) => <span key={k} className="rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-300"><Pill status={k} /> <span className="ml-1 font-semibold">{String(v)}</span></span>)}
            {!Object.keys(data?.integrationStatuses ?? {}).length ? <p className="text-xs text-slate-500">No adapters registered yet.</p> : null}
          </div>
        </Panel>
        <Panel title="Recent provisioning jobs">
          <Table rows={data?.recentJobs ?? []} empty="No provisioning jobs yet." columns={[
            { key: 'code', label: 'Job', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
            { key: 'action', label: 'Action' },
            { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
            { key: 'createdAt', label: 'Created', render: (r) => fmtDate(r.createdAt) },
          ]} />
        </Panel>
        <Panel title="Recent audit events" description="Sensitive operations and denials are recorded here and in the platform audit log.">
          <Table rows={data?.recentAudit ?? []} empty="No audit events yet." columns={[
            { key: 'action', label: 'Action', render: (r) => <span className="font-mono text-[10px]">{r.action}</span> },
            { key: 'decision', label: 'Decision', render: (r) => <Pill status={r.decision} /> },
            { key: 'actor', label: 'Actor' },
            { key: 'createdAt', label: 'When', render: (r) => fmtDate(r.createdAt) },
          ]} />
        </Panel>
      </div>
      <Notice>{data?.note ?? 'Every value is read from the control-plane database.'}</Notice>
    </div>
  )
}

/* ------------------------------------------------------------ 2. Company registry */
export function CompaniesPanel({ tick, reloadAll, role }: PanelProps) {
  const [wizard, setWizard] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [reuseSource, setReuseSource] = useState('')
  const [reuseSlug, setReuseSlug] = useState('')
  const [reuseEmail, setReuseEmail] = useState('')
  const [contractStatus, setContractStatus] = useState('')
  const [supportStatus, setSupportStatus] = useState('')
  const { data, error } = useEndpoint<Row>('/api/factory/companies', tick)
  const detail = useEndpoint<Row>(selected ? `/api/factory/companies/${selected}` : null, tick)
  const { busy, run } = useAction(reloadAll)
  if (wizard) return <Wizard onDone={() => { setWizard(false); reloadAll() }} />
  if (error) return <Notice tone="warn">{error}</Notice>
  const companies: Row[] = data?.companies ?? []
  return (
    <div className="space-y-4">
      <Panel title="Company Registry" description="Parent, sister, client and business-unit organizations with their application instances."
        actions={<Btn tone="primary" onClick={() => setWizard(true)}>Create New Company</Btn>}>
        <Table rows={companies} empty="No companies yet. Use the wizard to create the first one." onRow={(r) => setSelected(r.id)} columns={[
          { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
          { key: 'name', label: 'Company', render: (r) => <span className="font-medium text-slate-200">{r.name}<span className="block text-[10px] text-slate-500">{r.slug}</span></span> },
          { key: 'kind', label: 'Type' },
          { key: 'isolationModel', label: 'Isolation', render: (r) => <Pill status={r.isolationModel} /> },
          { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
          { key: 'apps', label: 'Apps', render: (r) => String((r.applications as Row[] | undefined)?.length ?? 0) },
          { key: 'createdAt', label: 'Created', render: (r) => fmtDate(r.createdAt) },
        ]} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Company detail" description={selected ? 'Registry metadata; private business data requires an explicit grant.' : 'Select a company above.'}>
          {!selected ? <p className="text-xs text-slate-500">No company selected.</p> : detail.error ? <Notice tone="warn">{detail.error}</Notice> : <>
            <div className="mb-3 flex flex-wrap gap-2">
              <Pill status={detail.data?.company?.status} />
              <Pill status={detail.data?.company?.isolationModel} />
              <span className="rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-400">{detail.data?.company?.kind}</span>
              {detail.data?.dataAccess ? <span className="rounded-md border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-400">Explicit data grant</span> : <span className="rounded-md border border-amber-500/30 px-2 py-1 text-[11px] text-amber-400">Registry metadata only</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contract status" value={detail.data?.company?.contractStatus ?? ''} onChange={() => undefined} disabled />
              <Field label="Support status" value={detail.data?.company?.supportStatus ?? ''} onChange={() => undefined} disabled />
            </div>
            <p className="mt-3 text-[11px] font-semibold text-slate-400">Applications</p>
            <Table rows={detail.data?.applications ?? []} empty="No applications." columns={[
              { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' },
              { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
              { key: 'healthStatus', label: 'Health', render: (r) => <Pill status={r.healthStatus} /> },
            ]} />
            <p className="mt-3 text-[11px] font-semibold text-slate-400">Access grants</p>
            <Table rows={detail.data?.members ?? []} empty="No grants." columns={[
              { key: 'userEmail', label: 'User' }, { key: 'role', label: 'Role' },
              { key: 'privileged', label: 'Privileged', render: (r) => String(Boolean(r.privileged)) },
              { key: 'expiresAt', label: 'Expires', render: (r) => fmtDate(r.expiresAt) },
            ]} />
          </>}
        </Panel>
        <div className="space-y-4">
          <Panel title="Update registry status" description="Contract, support and lifecycle state are control-plane metadata.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contract status" value={contractStatus} onChange={setContractStatus} placeholder="ACTIVE" />
              <Field label="Support status" value={supportStatus} onChange={setSupportStatus} placeholder="MAINTAINED" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn disabled={!selected} onClick={async () => {
                if (!selected) return
                try { await apiPatch(`/api/factory/companies/${selected}`, { contractStatus, supportStatus }); reloadAll() } catch { /* toast surfaced by the caller */ }
              }}>Save registry metadata</Btn>
              <Select label="Lifecycle" value="" onChange={async (v) => {
                if (!selected || !v) return
                try { await apiPatch(`/api/factory/companies/${selected}`, { status: v }); reloadAll() } catch { /* no-op */ }
              }} options={[{ value: '', label: 'Change status…' }, ...['CONFIGURED', 'ACTIVE', 'SUSPENDED', 'RETIRED'].map((x) => ({ value: x, label: x }))]} />
            </div>
          </Panel>
          <Panel title="Reuse an approved definition" description="Create another instance from a versioned definition. A new slug, tenant key, domain and users are mandatory; no live customer data is copied.">
            <div className="grid gap-3">
              <Select label="Source company" value={reuseSource} onChange={setReuseSource} options={[{ value: '', label: 'Choose…' }, ...companies.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))]} />
              <Field label="New slug" value={reuseSlug} onChange={setReuseSlug} placeholder="new-company-slug" />
              <Field label="New COMPANY_ADMIN email" value={reuseEmail} onChange={setReuseEmail} placeholder="admin@newcompany.test" />
              <Btn tone="primary" disabled={!reuseSource || !reuseSlug || !reuseEmail || busy === 'reuse'} onClick={() => run('reuse', '/api/factory/companies', {
                action: 'reuse', sourceCompanyId: reuseSource,
                overrides: { slug: reuseSlug, identity: { name: reuseSlug.replace(/-/g, ' ') }, users: [{ email: reuseEmail, role: 'COMPANY_ADMIN' }] },
              })}>Create instance from definition</Btn>
            </div>
          </Panel>
          <Notice>Factory administrators ({role}) manage registry metadata but need an explicit, audited company grant to read private business data.</Notice>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- 3. Templates */
export function TemplatesPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/templates', tick)
  const [selected, setSelected] = useState('')
  const { busy, run } = useAction(reloadAll)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [category, setCategory] = useState('Custom')
  const [baseTemplate, setBaseTemplate] = useState('')
  if (error) return <Notice tone="warn">{error}</Notice>
  const templates: Row[] = data?.templates ?? []
  const versions: Row[] = data?.versions ?? []
  return (
    <div className="space-y-4">
      <Panel title="Private Template Library" description="Versioned, approval-gated application templates. Production-ready is granted only after validation checks pass.">
        <Table rows={templates} empty="No templates. Initialize the library from Overview." onRow={(r) => setSelected(r.id)} columns={[
          { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
          { key: 'name', label: 'Name' }, { key: 'category', label: 'Category' },
          { key: 'currentVersion', label: 'Current version' },
          { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
          { key: 'modules', label: 'Modules', render: (r) => String((data?.links as Row[] | undefined)?.filter((l) => versions.find((v) => v.id === l.templateVersionId)?.templateId === r.id).length ?? 0) },
        ]} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Versions &amp; release gates" description={selected ? 'Validate → approve a version. A new version branches from the approved definition.' : 'Select a template above.'}>
          <Table rows={versions.filter((v) => !selected || v.templateId === selected)} empty="No versions." columns={[
            { key: 'version', label: 'v' }, { key: 'semver', label: 'Semver' },
            { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
            { key: 'approvedBy', label: 'Approved by' },
            { key: 'actions', label: 'Actions', render: (r) => (
              <span className="flex gap-1.5">
                <Btn disabled={busy === `v-${r.id}`} onClick={() => run(`v-${r.id}`, '/api/factory/templates', { action: 'validate', templateVersionId: r.id })}>Validate</Btn>
                <Btn disabled={busy === `a-${r.id}`} onClick={() => run(`a-${r.id}`, '/api/factory/templates', { action: 'approve', templateVersionId: r.id })}>Approve</Btn>
              </span>
            ) },
          ]} />
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1"><Select label="Branch a new version from" value={selected} onChange={setSelected} options={[{ value: '', label: 'Choose…' }, ...templates.map((t) => ({ value: t.id, label: t.name }))]} /></div>
            <Btn disabled={!selected || busy === 'version'} onClick={() => run('version', '/api/factory/templates', { action: 'new-version', templateId: selected, releaseNotes: 'Branched through the control center' })}>Create version</Btn>
          </div>
        </Panel>
        <Panel title="Register a new template" description="New templates start as DRAFT and must pass validation and approval.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" value={newCode} onChange={setNewCode} placeholder="field-service" />
            <Field label="Name" value={newName} onChange={setNewName} placeholder="Field Service Suite" />
            <Field label="Category" value={category} onChange={setCategory} />
            <Select label="Base definition from" value={baseTemplate} onChange={setBaseTemplate} options={[{ value: '', label: 'Choose…' }, ...templates.map((t) => ({ value: t.code, label: t.name }))]} />
          </div>
          <div className="mt-3"><Btn tone="primary" disabled={!newCode || !newName || !baseTemplate || busy === 'create'} onClick={async () => {
            const source = versions.find((v) => v.templateId === templates.find((t) => t.code === baseTemplate)?.id)
            if (!source) return
            await run('create', '/api/factory/templates', { action: 'create', code: newCode, name: newName, category, description: `Branched from ${baseTemplate}`, definition: JSON.parse(source.definition) })
          }}>Register draft template</Btn></div>
          <Notice>Only implemented shared capabilities can be composed. A template with an unknown capability can never pass validation.</Notice>
        </Panel>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- 4. Modules */
export function ModulesPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/modules', tick)
  const [moduleCode, setModuleCode] = useState('')
  const [impact, setImpact] = useState<Row | null>(null)
  const [newModule, setNewModule] = useState({ code: '', name: '', category: 'Extension', capability: 'contacts' })
  const { busy, run } = useAction(reloadAll)
  if (error) return <Notice tone="warn">{error}</Notice>
  const modules: Row[] = data?.modules ?? []
  const versions: Row[] = data?.versions ?? []
  return (
    <div className="space-y-4">
      <Panel title="Reusable Module Library" description="One implementation per shared capability; versions are pinned by templates and applications.">
        <Table rows={modules} onRow={(r) => setModuleCode(r.code)} empty="No modules. Initialize the library from Overview." columns={[
          { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
          { key: 'name', label: 'Name' }, { key: 'capability', label: 'Capability' },
          { key: 'currentVersion', label: 'Current version' },
          { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
        ]} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Versions, impact analysis and approvals" description="An approved module update identifies every dependent template and application.">
          <Table rows={versions.filter((v) => !moduleCode || modules.find((m) => m.id === v.moduleId)?.code === moduleCode)} empty="No versions." columns={[
            { key: 'module', label: 'Module', render: (r) => modules.find((m) => m.id === r.moduleId)?.code ?? '—' },
            { key: 'version', label: 'v' }, { key: 'semver', label: 'Semver' },
            { key: 'breaking', label: 'Breaking', render: (r) => String(Boolean(r.breaking)) },
            { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
            { key: 'actions', label: 'Actions', render: (r) => <Btn disabled={busy === `approve-${r.id}`} onClick={() => run(`approve-${r.id}`, '/api/factory/modules', { action: 'approve', moduleVersionId: r.id })}>Approve</Btn> },
          ]} />
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1"><Select label="Module" value={moduleCode} onChange={setModuleCode} options={[{ value: '', label: 'All modules' }, ...modules.map((m) => ({ value: m.code, label: m.name }))]} /></div>
            <Btn disabled={!moduleCode || busy === 'version'} onClick={() => run('version', '/api/factory/modules', { action: 'version', moduleId: modules.find((m) => m.code === moduleCode)?.id, releaseNotes: 'Non-breaking improvement' })}>New version</Btn>
            <Btn disabled={!moduleCode} onClick={async () => {
              try { setImpact((await fetch(`/api/factory/modules/${moduleCode}`).then((r) => r.json())).impact ?? null) } catch { setImpact(null) }
            }}>Impact analysis</Btn>
          </div>
          {impact ? <div className="mt-3"><JsonBlock value={impact} maxHeight={200} /></div> : null}
        </Panel>
        <Panel title="Register a shared capability" description="Only capabilities implemented by this control plane can be registered as working modules.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Module code" value={newModule.code} onChange={(v) => setNewModule((m) => ({ ...m, code: v }))} placeholder="billing" />
            <Field label="Name" value={newModule.name} onChange={(v) => setNewModule((m) => ({ ...m, name: v }))} />
            <Select label="Capability" value={newModule.capability} onChange={(v) => setNewModule((m) => ({ ...m, capability: v }))} options={IMPLEMENTED.map((c) => ({ value: c, label: c }))} />
            <Field label="Category" value={newModule.category} onChange={(v) => setNewModule((m) => ({ ...m, category: v }))} />
          </div>
          <div className="mt-3"><Btn tone="primary" disabled={!newModule.code || busy === 'newmod'} onClick={() => run('newmod', '/api/factory/modules', {
            action: 'create', ...newModule, description: 'Custom shared capability registered through the control center',
            manifest: {
              schemaVersion: 1, capability: newModule.capability, dependencies: ['identity'],
              permissions: [`${newModule.code}.read`, `${newModule.code}.write`], configKeys: [],
              entities: [{ key: 'ITEM', label: 'Item', fields: [{ key: 'name', label: 'Name', type: 'text', required: true }] }],
              migrations: [], testDefinitions: ['record schema validation', 'company scoping'], acceptanceCriteria: ['cross-company reads denied'],
            },
          })}>Register draft module</Btn></div>
          <Notice>Breaking changes are never pushed to a live application. Compatibility, staging, approval, a verified backup and rollback are separate steps.</Notice>
        </Panel>
      </div>
    </div>
  )
}

const IMPLEMENTED = ['identity', 'contacts', 'workflow', 'documents', 'audit', 'notifications', 'reporting', 'integration_hub']

/* ------------------------------------------------------------- 5. Applications */
export function ApplicationsPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/applications', tick)
  const [selected, setSelected] = useState('')
  const [configText, setConfigText] = useState('')
  const [evidence, setEvidence] = useState('')
  const [grantEmail, setGrantEmail] = useState('')
  const detail = useEndpoint<Row>(selected ? `/api/factory/applications/${selected}` : null, tick)
  const { busy, run } = useAction(reloadAll)
  if (error) return <Notice tone="warn">{error}</Notice>
  const apps: Row[] = data?.applications ?? []
  const doAction = (action: string, extra: Row = {}) => selected && run(action, '/api/factory/applications', { action, applicationId: selected, ...extra })
  return (
    <div className="space-y-4">
      <Panel title="Application Factory" description="Provisioned instances with a real lifecycle. Statuses come from the database.">
        <Table rows={apps} empty="No applications yet." onRow={(r) => setSelected(r.id)} columns={[
          { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
          { key: 'name', label: 'Application' },
          { key: 'environment', label: 'Env' },
          { key: 'deploymentModel', label: 'Model', render: (r) => <Pill status={r.deploymentModel} /> },
          { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
          { key: 'healthStatus', label: 'Health', render: (r) => <Pill status={r.healthStatus} /> },
          { key: 'releaseVersion', label: 'Release' },
        ]} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Lifecycle controls" description={selected ? `Selected ${selected}` : 'Select an application above.'}>
          <div className="flex flex-wrap gap-2">
            <Btn disabled={!selected || busy === 'submit'} onClick={() => doAction('submit')}>Submit for approval</Btn>
            <Btn tone="primary" disabled={!selected || busy === 'activate'} onClick={() => doAction('activate', { evidence })}>Approve &amp; activate</Btn>
            <Btn disabled={!selected || busy === 'health'} onClick={() => doAction('health')}>Run health check</Btn>
            <Btn tone="danger" disabled={!selected || busy === 'retire'} onClick={() => doAction('retire', { reason: 'Retired after verified final backup through the control center' })}>Retire</Btn>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Dedicated deployment evidence (min 20 chars)" value={evidence} onChange={setEvidence} placeholder="Separate DB, storage, credentials, domain and TLS verified by…" />
            <Field label="Privileged access grant (email)" value={grantEmail} onChange={setGrantEmail} placeholder="engineer@bdtech360.com" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn disabled={!selected || !grantEmail} onClick={() => doAction('grant', { email: grantEmail, reason: 'Temporary support investigation authorized through the control center', days: 7 })}>Grant time-limited access</Btn>
            <Btn disabled={!selected} onClick={async () => { if (selected) window.open(`/api/factory/applications/${selected}`, '_blank') }}>Open API detail</Btn>
          </div>
          <Notice tone="warn">Activation requires passed tests, a verified backup, health, an authorized approval and (for dedicated instances) recorded infrastructure evidence. Retirement preserves data.</Notice>
        </Panel>
        <Panel title="Company-specific configuration" description="Only configuration keys may be changed here; every change creates a versioned revision.">
          <p className="mb-2 text-[11px] text-slate-500">Allowed keys: branding, navigation, fields, workflows, reports, integrations, retention, extensions, departments, teams.</p>
          <textarea className="h-40 w-full rounded-md border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs text-slate-200"
            value={configText} onChange={(e) => setConfigText(e.target.value)} placeholder={'{ "branding": { "primaryColor": "#063B8F" } }'} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn tone="primary" disabled={!selected || !configText} onClick={async () => {
              try { await doAction('config', { config: JSON.parse(configText) }) } catch { /* JSON parse error shown by the browser */ }
            }}>Apply configuration change</Btn>
            <Btn disabled={!selected} onClick={() => setConfigText(JSON.stringify({ branding: JSON.parse(JSON.stringify(detail.data?.config?.branding ?? {})), navigation: detail.data?.config?.navigation ?? [] }, null, 2))}>Load current branding</Btn>
          </div>
        </Panel>
      </div>
      {selected ? <Panel title="Application detail" description={detail.data?.deployment ?? ''}>
        {detail.error ? <Notice tone="warn">{detail.error}</Notice> : <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-[10px] uppercase text-slate-500">Status</p><Pill status={detail.data?.application?.status} /></div>
            <div><p className="text-[10px] uppercase text-slate-500">Health</p><Pill status={detail.data?.application?.healthStatus} /></div>
            <div><p className="text-[10px] uppercase text-slate-500">Records</p><p className="text-sm text-slate-200">{detail.data?.recordCount ?? 'grant required'}</p></div>
            <div><p className="text-[10px] uppercase text-slate-500">Files</p><p className="text-sm text-slate-200">{detail.data?.fileCount ?? 'grant required'}</p></div>
          </div>
          <p className="mt-3 text-[11px] font-semibold text-slate-400">Pinned modules</p>
          <Table rows={detail.data?.modules ?? []} empty="No modules." columns={[
            { key: 'moduleId', label: 'Module' }, { key: 'semver', label: 'Version' },
            { key: 'enabled', label: 'Enabled', render: (r) => String(Boolean(r.enabled)) },
          ]} />
          <p className="mt-3 text-[11px] font-semibold text-slate-400">Config revisions</p>
          <Table rows={detail.data?.revisions ?? []} empty="No revisions." columns={[
            { key: 'version', label: 'v' }, { key: 'changeType', label: 'Type' },
            { key: 'checksum', label: 'Checksum', render: (r) => <span className="font-mono text-[10px]">{short(r.checksum, 16)}</span> },
            { key: 'createdAt', label: 'When', render: (r) => fmtDate(r.createdAt) },
          ]} />
        </>}
      </Panel> : null}
    </div>
  )
}
/* --------------------------------------------------- 6. Provisioning queue */
export function JobsPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/jobs', tick)
  const [companyId, setCompanyId] = useState('')
  const [jobId, setJobId] = useState('')
  const { busy, run } = useAction(reloadAll)
  if (error) return <Notice tone="warn">{error}</Notice>
  const jobs: Row[] = data?.jobs ?? []
  return (
    <Panel title="Provisioning Queue" description="Jobs contain the real step-by-step results of validation, provisioning and acceptance checks.">
      <Table rows={jobs} empty="No jobs yet." columns={[
        { key: 'code', label: 'Job', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
        { key: 'action', label: 'Action' },
        { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
        { key: 'steps', label: 'Steps', render: (r) => {
          let parsed: Row[] = []
          try { parsed = JSON.parse(r.steps ?? '[]') } catch { /* ignore */ }
          return `${parsed.filter((s) => s.status === 'PASS').length}/${parsed.length} passed`
        } },
        { key: 'createdAt', label: 'Created', render: (r) => fmtDate(r.createdAt) },
      ]} />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Company id (scope)" value={companyId} onChange={setCompanyId} placeholder="Select from the registry" />
        <Select label="Job" value={jobId} onChange={setJobId} options={[{ value: '', label: 'Choose…' }, ...jobs.map((j) => ({ value: j.id, label: `${j.code} (${j.companyId?.slice(0, 8)})` }))]} />
        <div className="flex items-end"><Btn disabled={!companyId || !jobId || busy === 'run'} onClick={() => run('run', '/api/factory/jobs', { companyId, jobId })}>Run a company-scoped background operation</Btn></div>
      </div>
      <div className="mt-3"><JsonBlock value={jobs[0]?.steps ? JSON.parse(jobs[0].steps) : []} maxHeight={180} /></div>
    </Panel>
  )
}

/* ------------------------------------------------- 7. Deployment / releases */
export function ReleasesPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/releases', tick)
  const [applicationId, setApplicationId] = useState('')
  const [moduleCode, setModuleCode] = useState('')
  const [targetVersion, setTargetVersion] = useState('2')
  const [note, setNote] = useState('Reviewed compatibility, staging checks and rollback point')
  const [impact, setImpact] = useState<Row | null>(null)
  const { busy, run } = useAction(reloadAll)
  if (error) return <Notice tone="warn">{error}</Notice>
  const releases: Row[] = data?.releases ?? []
  const act = (action: string, releaseId: string, extra: Row = {}) => run(`${action}-${releaseId}`, '/api/factory/releases', { action, releaseId, ...extra })
  return (
    <div className="space-y-4">
      <Panel title="Deployment Center &amp; Release Management" description="Draft → compatibility → staging → approval → deploy → monitored → rollback. Breaking changes are refused.">
        <Table rows={releases} empty="No releases yet." columns={[
          { key: 'code', label: 'Release', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
          { key: 'kind', label: 'Kind' }, { key: 'toVersion', label: 'To' },
          { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
          { key: 'approvedBy', label: 'Approved by' },
          { key: 'actions', label: 'Actions', render: (r) => (
            <span className="flex flex-wrap gap-1">
              <Btn disabled={busy === `stage-${r.id}`} onClick={() => act('stage', r.id)}>Stage</Btn>
              <Btn disabled={busy === `approve-${r.id}`} onClick={() => act('approve', r.id, { note })}>Approve</Btn>
              <Btn disabled={busy === `deploy-${r.id}`} onClick={() => act('deploy', r.id)}>Deploy</Btn>
              <Btn tone="danger" disabled={busy === `rollback-${r.id}`} onClick={() => act('rollback', r.id)}>Rollback</Btn>
            </span>
          ) },
        ]} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Plan an upgrade" description="Impact analysis identifies dependent templates and applications before anything changes.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Application id" value={applicationId} onChange={setApplicationId} placeholder="From Application Factory" />
            <Select label="Shared module" value={moduleCode} onChange={setModuleCode} options={[{ value: '', label: 'Configuration only' }, ...(data?.modules ?? []).map((m: Row) => ({ value: m.code, label: m.name }))]} />
            <Field label="Target module version" value={targetVersion} onChange={setTargetVersion} type="number" />
            <Field label="Approval note" value={note} onChange={setNote} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn tone="primary" disabled={!applicationId || busy === 'create'} onClick={() => run('create', '/api/factory/releases', { action: 'create', applicationId, moduleCode: moduleCode || undefined, targetVersion: Number(targetVersion) || undefined })}>Create upgrade release</Btn>
            <Btn disabled={!moduleCode} onClick={async () => {
              try { setImpact((await fetch(`/api/factory/releases?module=${moduleCode}`).then((r) => r.json())).impact ?? null) } catch { setImpact(null) }
            }}>Load impact analysis</Btn>
          </div>
          <Notice>Staging upgrades never touch a live application. Deployment requires approval and a verified pre-deploy backup; rollback restores the known-good configuration revision and module pins.</Notice>
        </Panel>
        <Panel title="Compatibility &amp; migration evidence">
          {impact?.impact ? <div className="mb-3"><p className="mb-1 text-[11px] font-semibold text-slate-400">Impact: {impact.applications?.length ?? 0} applications / {impact.templates?.length ?? 0} templates</p><JsonBlock value={impact} maxHeight={180} /></div> : null}
          {releases[0]?.compatibility ? <JsonBlock value={JSON.parse(releases[0].compatibility)} maxHeight={220} /> : <p className="text-xs text-slate-500">No compatibility report recorded yet.</p>}
          {releases[0]?.deploymentSpec ? <div className="mt-3"><p className="mb-1 text-[11px] font-semibold text-slate-400">Deployment specification (honest state)</p><JsonBlock value={JSON.parse(releases[0].deploymentSpec)} maxHeight={220} /></div> : null}
        </Panel>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- 8. Integration hub */
export function IntegrationsPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/integrations', tick)
  const [companyId, setCompanyId] = useState('')
  const { busy, run } = useAction(reloadAll)
  if (error) return <Notice tone="warn">{error}</Notice>
  const rows: Row[] = data?.integrations ?? []
  return (
    <div className="space-y-4">
      <Panel title="Integration Hub" description="Replaceable adapters. Own the architecture and business logic; external networks remain external." actions={
        <div className="flex items-end gap-2"><Field label="Company id" value={companyId} onChange={setCompanyId} /><Btn disabled={!companyId || busy === 'refresh'} onClick={() => run('refresh', '/api/factory/integrations', { action: 'refresh', companyId })}><RefreshCw className="size-3.5" /> Re-check</Btn></div>
      }>
        <Table rows={rows} empty="No adapters registered yet. Provision a company first." columns={[
          { key: 'providerKey', label: 'Adapter', render: (r) => <span className="font-mono text-[11px]">{r.providerKey}</span> },
          { key: 'kind', label: 'Kind' },
          { key: 'enabled', label: 'Enabled', render: (r) => String(Boolean(r.enabled)) },
          { key: 'configured', label: 'Credentials', render: (r) => String(Boolean(r.configured)) },
          { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <Btn disabled={busy === `t-${r.id}`} onClick={() => run(`t-${r.id}`, '/api/factory/integrations', { action: 'toggle', companyId: r.companyId, providerKey: r.providerKey, enabled: !r.enabled })}>{r.enabled ? 'Disable' : 'Enable'}</Btn>
          ) },
        ]} />
      </Panel>
      <Panel title="Adapter catalogue, limitations and dependencies" description="Provider fees and restrictions are documented; an unconfigured adapter is never reported as connected.">
        <Table rows={data?.adapters ?? []} empty="No adapters." columns={[
          { key: 'key', label: 'Key', render: (r) => <span className="font-mono text-[11px]">{r.key}</span> },
          { key: 'label', label: 'Name' }, { key: 'kind', label: 'Kind' },
          { key: 'limitation', label: 'Limitation', render: (r) => <span className="block max-w-[280px] text-[10px] text-slate-400">{r.limitation}</span> },
          { key: 'dependencyNote', label: 'Dependency', render: (r) => <span className="block max-w-[280px] text-[10px] text-slate-400">{r.dependencyNote}</span> },
        ]} />
        <div className="mt-3"><Notice>{data?.policy}</Notice></div>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------- 9. Monitoring */
export function MonitoringPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/monitoring', tick)
  const { busy, run } = useAction(reloadAll)
  if (error) return <Notice tone="warn">{error}</Notice>
  const alerts: Row[] = data?.alerts ?? []
  return (
    <div className="space-y-4">
      {alerts.length ? <Notice tone="warn"><AlertTriangle className="mr-1 inline size-3.5" /> {alerts.length} application(s) reporting DEGRADED or DOWN: {alerts.map((a) => a.code).join(', ')}</Notice> : <Notice tone="good">No degraded applications in the last real health checks.</Notice>}
      <Panel title="Monitoring &amp; Alerts" description="Health checks are recomputed from the database; no timer or decorative status.">
        <Table rows={data?.applications ?? []} empty="No applications." columns={[
          { key: 'code', label: 'Application' }, { key: 'status', label: 'Lifecycle', render: (r) => <Pill status={r.status} /> },
          { key: 'healthStatus', label: 'Health', render: (r) => <Pill status={r.healthStatus} /> },
          { key: 'lastHealthAt', label: 'Last check', render: (r) => fmtDate(r.lastHealthAt) },
          { key: 'actions', label: 'Actions', render: (r) => <Btn disabled={busy === `h-${r.id}`} onClick={() => run(`h-${r.id}`, '/api/factory/monitoring', { applicationId: r.id })}>Run check</Btn> },
        ]} />
      </Panel>
      <Panel title="Recent check results">
        <Table rows={data?.checks ?? []} empty="No checks recorded." columns={[
          { key: 'applicationId', label: 'Application', render: (r) => short(r.applicationId, 12) },
          { key: 'status', label: 'Result', render: (r) => <Pill status={r.status} /> },
          { key: 'checkedBy', label: 'By' },
          { key: 'checks', label: 'Checks', render: (r) => { try { return `${JSON.parse(r.checks).filter((c: Row) => c.ok).length}/${JSON.parse(r.checks).length} passed` } catch { return '—' } } },
          { key: 'checkedAt', label: 'When', render: (r) => fmtDate(r.checkedAt) },
        ]} />
      </Panel>
    </div>
  )
}

/* -------------------------------------------------------- 10. Security & audit */
export function SecurityPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/audit', tick)
  if (error) return <Notice tone="warn">{error} — company-scoped audit requires an explicit grant.</Notice>
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"><p className="text-[10px] uppercase text-slate-500">Audit events</p><p className="text-2xl font-semibold text-slate-100">{data?.total ?? '—'}</p></div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"><p className="text-[10px] uppercase text-slate-500">Denied operations</p><p className="text-2xl font-semibold text-amber-400">{data?.denials ?? '—'}</p></div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"><p className="text-[10px] uppercase text-slate-500">Isolation rule</p><p className="mt-2 text-xs text-slate-300">Server-side grants only</p></div>
      </div>
      <Panel title="Security &amp; Audit Center" description="Append-only control-plane audit events, including every denied cross-company attempt.">
        <Table rows={data?.events ?? []} empty="No audit events." columns={[
          { key: 'action', label: 'Action', render: (r) => <span className="font-mono text-[10px]">{r.action}</span> },
          { key: 'decision', label: 'Decision', render: (r) => <Pill status={r.decision} /> },
          { key: 'actor', label: 'Actor' },
          { key: 'targetType', label: 'Target' },
          { key: 'detail', label: 'Detail', render: (r) => <span className="block max-w-[240px] truncate text-[10px] text-slate-500">{short(r.detail, 60)}</span> },
          { key: 'createdAt', label: 'When', render: (r) => fmtDate(r.createdAt) },
        ]} />
      </Panel>
      <Notice>Factory administrators do not automatically receive a client&apos;s private business data. Privileged grants require a grantor, a recorded reason and an expiry, and every denial is audited.</Notice>
    </div>
  )
}

/* ------------------------------------------------------------- 11. Backups */
export function BackupsPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/backups', tick)
  const [applicationId, setApplicationId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const { busy, run } = useAction(reloadAll)
  if (error) return <Notice tone="warn">{error}</Notice>
  return (
    <div className="space-y-4">
      <Panel title="Backup &amp; Recovery" description="A backup is verified only when its SHA-256, counts and secret scan actually pass.">
        <Table rows={data?.backups ?? []} empty="No backups yet." columns={[
          { key: 'code', label: 'Backup', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
          { key: 'kind', label: 'Kind' }, { key: 'sizeBytes', label: 'Bytes' },
          { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
          { key: 'verifiedAt', label: 'Verified', render: (r) => fmtDate(r.verifiedAt) },
          { key: 'checksum', label: 'Checksum', render: (r) => <span className="font-mono text-[10px]">{short(r.checksum, 14)}</span> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <span className="flex flex-wrap gap-1">
              <Btn disabled={busy === `v-${r.id}`} onClick={() => run(`v-${r.id}`, '/api/factory/backups', { action: 'verify', backupId: r.id })}>Verify</Btn>
              <Btn disabled={busy === `r-${r.id}`} onClick={() => run(`r-${r.id}`, '/api/factory/backups', { action: 'restore', backupId: r.id, companyId })}>Restore</Btn>
              <Btn onClick={() => window.open(`/api/factory/backups?download=${r.id}`, '_blank')}>Export</Btn>
            </span>
          ) },
        ]} />
      </Panel>
      <Panel title="Create a backup" description="The portable JSON archive contains config, definitions, module pins, records, files, releases and restore instructions — never credentials.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Application id" value={applicationId} onChange={setApplicationId} />
          <Field label="Company id (for restore scope)" value={companyId} onChange={setCompanyId} />
          <div className="flex items-end"><Btn tone="primary" disabled={!applicationId || busy === 'create'} onClick={() => run('create', '/api/factory/backups', { action: 'create', applicationId, kind: 'FULL' })}>Create full backup</Btn></div>
        </div>
        <div className="mt-3"><Notice tone="warn">Restore creates a NEW staging application inside the SAME company. Cross-company restore is refused so one client&apos;s live data can never be copied into another client&apos;s instance.</Notice></div>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------- 12. Engineering */
export function EngineeringPanel({ tick, reloadAll }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/engineering', tick)
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [disposition, setDisposition] = useState('MODULE')
  const { busy, run } = useAction(reloadAll)
  if (error) return <Notice tone="warn">{error}</Notice>
  const requests: Row[] = data?.requests ?? []
  return (
    <div className="space-y-4">
      <Panel title="Engineering Workspace" description="Triage each requirement into shared core, reusable module, configuration or client-specific extension.">
        <Table rows={requests} empty="No change requests yet." columns={[
          { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
          { key: 'title', label: 'Request' }, { key: 'type', label: 'Type' },
          { key: 'disposition', label: 'Disposition', render: (r) => <Pill status={r.disposition} /> },
          { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <span className="flex gap-1">
              <Btn disabled={busy === `t-${r.id}`} onClick={() => run(`t-${r.id}`, '/api/factory/engineering', { action: 'triage', requestId: r.id, disposition, decision: `Triaged as ${disposition} through the control center` })}>Triage</Btn>
              <Btn disabled={busy === `a-${r.id}`} onClick={() => run(`a-${r.id}`, '/api/factory/engineering', { action: 'approve', requestId: r.id, decision: 'Reviewed impact, tests and release plan; approved by engineering' })}>Approve</Btn>
            </span>
          ) },
        ]} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="New change request">
          <div className="grid gap-3">
            <Field label="Title" value={title} onChange={setTitle} placeholder="Add a configurable approval chain" />
            <Field label="Details" value={details} onChange={setDetails} placeholder="Which company requested it, and what is the reusable part?" />
            <Select label="Default triage disposition" value={disposition} onChange={setDisposition} options={(data?.dispositions ?? ['MODULE']).filter((d: string) => d !== 'PENDING_TRIAGE').map((d: string) => ({ value: d, label: d.replace(/_/g, ' ') }))} />
            <Btn tone="primary" disabled={!title || busy === 'new'} onClick={() => { run('new', '/api/factory/engineering', { action: 'create', title, details, type: 'CHANGE' }); setTitle(''); setDetails('') }}>Create change request</Btn>
          </div>
        </Panel>
        <Panel title="Reusable assets &amp; releases">
          <p className="text-[11px] font-semibold text-slate-400">Shared modules</p>
          <Table rows={data?.modules ?? []} empty="No modules." columns={[{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'currentVersion', label: 'Version' }]} />
          <p className="mt-3 text-[11px] font-semibold text-slate-400">Recent releases</p>
          <Table rows={data?.releases ?? []} empty="No releases." columns={[{ key: 'code', label: 'Code' }, { key: 'status', label: 'Status', render: (r) => <Pill status={r.status} /> }]} />
        </Panel>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- 13. Documentation */
export function DocsPanel({ tick }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/docs', tick)
  if (error) return <Notice tone="warn">{error}</Notice>
  return (
    <div className="space-y-4">
      <Panel title="Documentation &amp; Help" description="The real process, with automated and manual steps stated separately.">
        <div className="flex flex-wrap gap-2">
          {(data?.pipeline ?? []).map((step: string, i: number) => (
            <span key={step} className="rounded-md border border-[#009FE3]/30 bg-[#009FE3]/5 px-2.5 py-1 text-[11px] text-slate-200">{i + 1}. {step}</span>
          ))}
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Automated by the factory">
          <ul className="space-y-1.5 text-xs text-slate-300">{(data?.automatedSteps ?? []).map((s: string) => <li key={s}>• {s}</li>)}</ul>
        </Panel>
        <Panel title="Requires a human, engineering or provider">
          <ul className="space-y-1.5 text-xs text-slate-300">{(data?.manualSteps ?? []).map((s: string) => <li key={s}>• {s}</li>)}</ul>
        </Panel>
      </div>
      <Panel title="Committed documents" description="existence is checked on this host — no broken documentation links are advertised.">
        <Table rows={data?.documents ?? []} empty="No documents." columns={[
          { key: 'path', label: 'Path', render: (r) => <span className="font-mono text-[11px]">{r.path}</span> },
          { key: 'exists', label: 'Present', render: (r) => <Pill status={r.exists ? 'AVAILABLE' : 'MISSING'} /> },
        ]} />
      </Panel>
    </div>
  )
}

/* --------------------------------------------------- Customer administration */
export function CustomerAdminPanel({ tick, reloadAll }: PanelProps) {
  const apps = useEndpoint<Row>('/api/factory/applications', tick)
  const [applicationId, setApplicationId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [records, setRecords] = useState<Row | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [fileName, setFileName] = useState('notes.txt')
  const [fileContent, setFileContent] = useState('Internal note')
  const { busy, run } = useAction(reloadAll)
  return (
    <div className="space-y-4">
      <Panel title="Customer Administration" description="Company-scoped business data. Every request is authorized server-side by an explicit company grant.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Application" value={applicationId} onChange={(v) => { setApplicationId(v); const a = (apps.data?.applications ?? []).find((x: Row) => x.id === v); setCompanyId(a?.companyId ?? '') }} options={[{ value: '', label: 'Choose…' }, ...(apps.data?.applications ?? []).map((a: Row) => ({ value: a.id, label: `${a.code} — ${a.name}` }))]} />
          <Field label="Company id (scope)" value={companyId} onChange={setCompanyId} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn disabled={!applicationId} onClick={async () => {
            try {
              const res = await fetch(`/api/factory/records?applicationId=${applicationId}&companyId=${companyId}`).then((r) => r.json())
              setRecords(res)
            } catch { setRecords(null) }
          }}>Load scoped records</Btn>
          <Btn disabled={!companyId} onClick={async () => {
            try { const r = await fetch(`/api/factory/reports?companyId=${companyId}`).then((x) => x.json()); setRecords({ ok: r.ok, report: r.data ?? r }) } catch { setRecords(null) }
          }}>Load company report</Btn>
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Create a contact record" description="Validated against the shared contacts module schema.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={name} onChange={setName} />
            <Field label="Email" value={email} onChange={setEmail} />
          </div>
          <div className="mt-3"><Btn tone="primary" disabled={!applicationId || !name || busy === 'record'} onClick={() => run('record', '/api/factory/records', {
            companyId, applicationId, moduleKey: 'contacts', entityType: 'CONTACT', data: { name, email },
          })}>Create record</Btn></div>
        </Panel>
        <Panel title="Upload a document" description="MIME/extension scanning and per-company ownership are enforced server-side.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="File name" value={fileName} onChange={setFileName} />
            <Field label="Text content" value={fileContent} onChange={setFileContent} />
          </div>
          <div className="mt-3"><Btn tone="primary" disabled={!applicationId || busy === 'file'} onClick={async () => {
            const base64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(fileContent))) : Buffer.from(fileContent).toString('base64')
            await run('file', '/api/factory/files', { companyId, applicationId, name: fileName, mimeType: 'text/plain', contentBase64: base64 })
          }}>Upload file</Btn></div>
        </Panel>
      </div>
      {records ? <Panel title="Scoped result"><JsonBlock value={records} maxHeight={260} /></Panel> : null}
    </div>
  )
}

export const PANEL_ICONS = { Activity, AlertTriangle, Boxes, Building2, DatabaseBackup, FileCode2, GitBranch, Layers, ListChecks, Plug, ShieldCheck, Sparkles, Workflow }
export { STATUS_OPTIONS }

/* ------------------------------------------------------- Deployment Center */
export function DeploymentsPanel({ tick }: PanelProps) {
  const { data, error } = useEndpoint<Row>('/api/factory/applications', tick)
  if (error) return <Notice tone="warn">{error}</Notice>
  const apps: Row[] = data?.applications ?? []
  return (
    <div className="space-y-4">
      <Panel title="Deployment Center" description="Environment, deployment model and domain per application. Dedicated infrastructure is never simulated.">
        <Table rows={apps} empty="No applications deployed." columns={[
          { key: 'code', label: 'Application', render: (r) => <span className="font-mono text-[11px]">{r.code}</span> },
          { key: 'environment', label: 'Environment', render: (r) => <Pill status={r.environment} /> },
          { key: 'deploymentModel', label: 'Deployment model', render: (r) => <Pill status={r.deploymentModel} /> },
          { key: 'domain', label: 'Domain' },
          { key: 'status', label: 'Lifecycle', render: (r) => <Pill status={r.status} /> },
          { key: 'healthStatus', label: 'Health', render: (r) => <Pill status={r.healthStatus} /> },
          { key: 'activatedAt', label: 'Activated', render: (r) => fmtDate(r.activatedAt) },
        ]} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Model A — shared platform, isolated tenant">
          <p className="text-xs leading-relaxed text-slate-300">One installation; server-side company grants, scoped records, files, reports, jobs, audit events and integration credentials. A tenant identifier coming from a browser is never accepted as authorization.</p>
        </Panel>
        <Panel title="Model B — dedicated instance">
          <p className="text-xs leading-relaxed text-slate-300">A distinct app instance and, where required, a separate database, object storage, credentials, deployment configuration and domain. The factory records the required manual steps and refuses to mark the application LIVE without recorded evidence; it does not pretend to have created infrastructure it cannot see.</p>
        </Panel>
      </div>
    </div>
  )
}
