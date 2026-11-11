'use client'

/**
 * Working Create New Company wizard — 15 explicit steps.
 *
 * Each step maps to a requirement of the master prompt. Every control is real:
 * validation calls /api/factory/companies (action=preview), provisioning calls
 * action=provision, and activation calls /api/factory/applications.
 * Nothing is simulated and no step claims success without a server result.
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Btn, Field, JsonBlock, Notice, Panel, Pill, Select, actionError, apiPost, type Row } from './shared'

const STEPS = [
  'Name & identity', 'Type, industry & template', 'Applications & modules',
  'Branding, logo, colours & navigation', 'Departments & teams', 'Users & roles',
  'Workflows, rules & SLA', 'Integrations', 'Storage, retention & backup',
  'Deployment environment', 'Dependency, permission, cost & requirement review',
  'Validation', 'Isolated provisioning, automated setup & acceptance tests',
  'Result review & activation approval', 'Access to the new company admin panel',
]
const KINDS = ['CLIENT', 'SISTER', 'PARENT', 'BUSINESS_UNIT']
const ROLES = ['COMPANY_ADMIN', 'COMPANY_USER', 'COMPANY_AUDITOR']
const ADAPTER_KEYS = ['internal_events', 'internal_webhooks', 'email_smtp', 'whatsapp_cloud', 'sms_gateway', 'telephony', 'payment_gateway']

export function Wizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [catalog, setCatalog] = useState<{ templates: Row[]; modules: Row[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Row | null>(null)
  const [result, setResult] = useState<Row | null>(null)
  const [form, setForm] = useState({
    name: '', slug: '', kind: 'CLIENT', industry: '', domain: '',
    isolationModel: 'SHARED_TENANT', deploymentModel: 'SHARED_TENANT', environment: 'STAGING',
    templateCode: '', templateVersion: 0, enabledModules: [] as string[],
    primaryColor: '#063B8F', accentColor: '#009FE3', logoText: '', productName: '', navigation: 'Overview, Contacts, Tasks, Reports',
    departments: 'Operations', teams: 'Core', users: [] as Array<{ email: string; role: string }>,
    pipelines: 'New, Qualified, Won', approvalChains: 'Company admin', slaHours: '48',
    retentionDays: '365', backupPolicy: 'DAILY', integrations: [] as string[],
    customFields: [] as Row[], extensions: [] as Row[],
  })

  useEffect(() => {
    apiPost<{ templates: Row[]; modules: Row[] }>('/api/factory/companies', { action: 'catalog' })
      .then((c) => {
        setCatalog(c)
        const first = c.templates[0]
        if (first) setForm((f) => ({
          ...f,
          templateCode: first.code,
          templateVersion: first.version?.version ?? first.currentVersion ?? 1,
          enabledModules: dedupeModules(first.modules ?? []).map((m: Row) => String(m.moduleId)),
        }))
      })
      .catch((e) => setError(actionError(e)))
  }, [])

  const template = catalog?.templates.find((t) => t.code === form.templateCode) ?? null
  const links = useMemo(() => dedupeModules(template?.modules ?? []), [template])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setPreview(null)
  }

  function definition(): Row {
    return {
      identity: {
        name: form.name, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        kind: form.kind, industry: form.industry || undefined, domain: form.domain || undefined,
        isolationModel: form.isolationModel, deploymentModel: form.deploymentModel, environment: form.environment,
      },
      template: { code: form.templateCode, version: Number(form.templateVersion) },
      modules: links.map((l: Row) => ({
        code: String(l.moduleId),
        version: Number(catalog?.modules.find((m) => m.code === l.moduleId)?.version ?? 1),
        enabled: l.required === true || form.enabledModules.includes(String(l.moduleId)),
      })),
      branding: { primaryColor: form.primaryColor, accentColor: form.accentColor, logoText: form.logoText || undefined, productName: form.productName || undefined },
      organization: { departments: split(form.departments), teams: split(form.teams), users: form.users.filter((u) => u.email.includes('@')) },
      workflows: { pipelines: split(form.pipelines), approvalChains: split(form.approvalChains), slaHours: Number(form.slaHours), rules: [] },
      policies: { retentionDays: Number(form.retentionDays), backupPolicy: form.backupPolicy },
      integrations: form.integrations, navigation: split(form.navigation),
      customFields: form.customFields, extensions: form.extensions,
    }
  }

  async function validate() {
    setBusy(true); setError(null)
    try {
      const res = await apiPost<Row>('/api/factory/companies', { action: 'preview', definition: definition() })
      setPreview(res)
      if (!res.ok) toast.error(`Validation found ${(res.errors as string[] | undefined)?.length ?? 0} issue(s)`)
      else toast.success('Configuration validated')
    } catch (e) { setError(actionError(e)) } finally { setBusy(false) }
  }

  async function provision() {
    setBusy(true); setError(null)
    try {
      const res = await apiPost<Row>('/api/factory/companies', { action: 'provision', definition: definition() })
      setResult(res)
      if (res.ok) { toast.success('Company provisioned with real acceptance checks'); onDone() }
      else toast.error('Provisioning did not pass its checks — see the step results')
    } catch (e) { setError(actionError(e)) } finally { setBusy(false) }
  }

  async function transition(action: string) {
    if (!result?.applicationId) return
    setBusy(true)
    try {
      const res = await apiPost<Row>('/api/factory/applications', { action, applicationId: result.applicationId })
      toast.success(res.reason || res.message || 'Done')
      onDone()
    } catch (e) { toast.error(actionError(e)) } finally { setBusy(false) }
  }

  const requiredCount = links.filter((l: Row) => l.required === true).length
  const enabledCount = links.filter((l: Row) => l.required === true || form.enabledModules.includes(String(l.moduleId))).length

  const content: React.ReactNode = (() => {
    switch (step) {
      case 0: return <>
        <Field label="Company name" value={form.name} onChange={(v) => set('name', v)} placeholder="Orchid Systems Ltd" />
        <Field label="Slug (unique identity)" value={form.slug} onChange={(v) => set('slug', v)} placeholder="auto-generated from name" hint="Must be unique across all companies" />
        <Field label="Domain (optional, must be unique)" value={form.domain} onChange={(v) => set('domain', v)} placeholder="orchid.example.com" />
      </>
      case 1: return <>
        <Select label="Company type" value={form.kind} onChange={(v) => set('kind', v)} options={KINDS.map((k) => ({ value: k, label: k.replace(/_/g, ' ') }))} />
        <Field label="Industry / business identity" value={form.industry} onChange={(v) => set('industry', v)} placeholder="Software" />
        <div className="sm:col-span-2 lg:col-span-3 grid gap-3 sm:grid-cols-2">
          <Select label="Approved private application template" value={form.templateCode} onChange={(v) => {
            const t = catalog?.templates.find((x) => x.code === v)
            setForm((f) => ({ ...f, templateCode: v, templateVersion: t?.version?.version ?? t?.currentVersion ?? 1, enabledModules: dedupeModules(t?.modules ?? []).map((m: Row) => String(m.moduleId)) }))
            setPreview(null)
          }} options={(catalog?.templates ?? []).map((t) => ({ value: t.code, label: `${t.name} (v${t.version?.version ?? t.currentVersion}, ${t.category})` }))} />
          <Field label="Template version" value={form.templateVersion} onChange={(v) => set('templateVersion', Number(v))} type="number" hint="Only approved versions may be provisioned" />
        </div>
      </>
      case 2: return <div className="sm:col-span-2 lg:col-span-3">
        <p className="mb-2 text-[11px] font-medium text-slate-400">Independently selectable modules — {enabledCount} enabled, {requiredCount} required by the template</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l: Row) => {
            const code = String(l.moduleId)
            const required = l.required === true
            const checked = required || form.enabledModules.includes(code)
            const mod = catalog?.modules.find((m) => m.code === code)
            return (
              <label key={code} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${checked ? 'border-[#009FE3]/40 bg-[#009FE3]/5' : 'border-slate-800'}`}>
                <input type="checkbox" className="mt-0.5" checked={checked} disabled={required} onChange={(e) => set('enabledModules', e.target.checked ? [...form.enabledModules, code] : form.enabledModules.filter((x) => x !== code))} />
                <span className="min-w-0"><span className="block font-medium text-slate-200">{code} <span className="text-[10px] text-slate-500">v{mod?.version ?? 1} · {mod?.semver ?? ''}</span></span>
                  <span className="block text-[10px] text-slate-500">{required ? 'Required by template' : 'Optional'} · {mod?.capability ?? ''}</span></span>
              </label>
            )
          })}
        </div>
        <div className="mt-3"><Notice>A CRM-only company is never forced to enable HR, finance, marketing or telephony. Only the selected and template-required modules are pinned.</Notice></div>
      </div>
      case 3: return <>
        <Field label="Primary colour (#RRGGBB)" value={form.primaryColor} onChange={(v) => set('primaryColor', v)} />
        <Field label="Accent colour (#RRGGBB)" value={form.accentColor} onChange={(v) => set('accentColor', v)} />
        <Field label="Product name" value={form.productName} onChange={(v) => set('productName', v)} />
        <Field label="Logo text" value={form.logoText} onChange={(v) => set('logoText', v)} />
        <div className="sm:col-span-2 lg:col-span-3"><Field label="Navigation (comma separated)" value={form.navigation} onChange={(v) => set('navigation', v)} /></div>
      </>
      case 4: return <>
        <Field label="Departments (comma separated)" value={form.departments} onChange={(v) => set('departments', v)} />
        <Field label="Teams (comma separated)" value={form.teams} onChange={(v) => set('teams', v)} />
      </>
      case 5: return <div className="sm:col-span-2 lg:col-span-3">
        <p className="mb-2 text-[11px] font-medium text-slate-400">At least one COMPANY_ADMIN is mandatory. These become explicit server-side grants.</p>
        <div className="space-y-2">
          {form.users.map((u, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input className="h-9 min-w-[220px] flex-1 rounded-md border border-slate-800 bg-slate-950/60 px-3 text-sm text-slate-200" placeholder="name@company.com"
                value={u.email} onChange={(e) => set('users', form.users.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
              <select className="h-9 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-sm text-slate-200" value={u.role}
                onChange={(e) => set('users', form.users.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Btn tone="danger" onClick={() => set('users', form.users.filter((_, j) => j !== i))}><Trash2 className="size-3.5" /></Btn>
            </div>
          ))}
          <Btn onClick={() => set('users', [...form.users, { email: '', role: 'COMPANY_ADMIN' }])}><Plus className="size-3.5" /> Add user</Btn>
        </div>
      </div>
      case 6: return <>
        <Field label="Pipeline stages (comma separated)" value={form.pipelines} onChange={(v) => set('pipelines', v)} />
        <Field label="Approval chains (comma separated)" value={form.approvalChains} onChange={(v) => set('approvalChains', v)} />
        <Field label="SLA hours" value={form.slaHours} onChange={(v) => set('slaHours', v)} type="number" />
        <div className="sm:col-span-2 lg:col-span-3"><Notice tone="warn">These are configuration-only differences. A genuinely new rule engine, schema field or integration belongs in the Engineering Workspace and a reviewed release.</Notice></div>
      </>
      case 7: return <div className="sm:col-span-2 lg:col-span-3">
        <p className="mb-2 text-[11px] font-medium text-slate-400">Integration adapters — credentials must exist in the environment; an unconfigured provider is never reported connected</p>
        <div className="flex flex-wrap gap-2">
          {ADAPTER_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-1.5 rounded-md border border-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300">
              <input type="checkbox" checked={form.integrations.includes(key)}
                onChange={(e) => set('integrations', e.target.checked ? [...form.integrations, key] : form.integrations.filter((x) => x !== key))} />
              {key}
            </label>
          ))}
        </div>
      </div>
      case 8: return <>
        <Field label="Data retention (days)" value={form.retentionDays} onChange={(v) => set('retentionDays', v)} type="number" />
        <Select label="Backup policy" value={form.backupPolicy} onChange={(v) => set('backupPolicy', v)} options={[
          { value: 'DAILY', label: 'DAILY' }, { value: 'WEEKLY', label: 'WEEKLY' }, { value: 'HOURLY', label: 'HOURLY' },
        ]} />
        <div className="sm:col-span-2 lg:col-span-3"><Notice>A backup row is not verification. Only a backup whose SHA-256, counts and secret scan pass is marked VERIFIED, and activation requires one.</Notice></div>
      </>
      case 9: return <>
        <Select label="Isolation / deployment model" value={form.isolationModel} onChange={(v) => { set('isolationModel', v); set('deploymentModel', v) }} options={[
          { value: 'SHARED_TENANT', label: 'Model A — shared platform, isolated tenant' },
          { value: 'DEDICATED', label: 'Model B — dedicated application instance' },
        ]} />
        <Select label="Environment" value={form.environment} onChange={(v) => set('environment', v)} options={[
          { value: 'DEV', label: 'Development' }, { value: 'STAGING', label: 'Staging' }, { value: 'PRODUCTION', label: 'Production' },
        ]} />
        <div className="sm:col-span-2 lg:col-span-3"><Notice tone={form.deploymentModel === 'DEDICATED' ? 'warn' : 'info'}>
          {form.deploymentModel === 'DEDICATED'
            ? 'A dedicated instance requires separate infrastructure (database, storage, credentials, domain, TLS). The factory records this as an explicit manual step and will NOT mark the application LIVE without recorded deployment evidence.'
            : 'A shared-tenant instance is isolated by server-side company grants, scoped records, files, reports, jobs, audit events and integration credentials. A tenant id in the UI is never treated as authorization.'}
        </Notice></div>
      </>
      case 10: return <div className="sm:col-span-2 lg:col-span-3 space-y-3">
        <Notice>Dependency check: {enabledCount} modules from approved template <strong>{form.templateCode}</strong> v{form.templateVersion}; required modules {requiredCount}; {form.users.filter((u) => u.email.includes('@')).length} user grant(s); unique slug/domain/tenant key enforced server-side.</Notice>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate-800 p-3"><p className="text-[10px] uppercase text-slate-500">Permissions</p><p className="mt-1 text-xs text-slate-300">Only explicit `FactoryCompanyMember` grants can read private business data. Factory admins are not automatically entitled.</p></div>
          <div className="rounded-md border border-slate-800 p-3"><p className="text-[10px] uppercase text-slate-500">Cost / external requirements</p><p className="mt-1 text-xs text-slate-300">Shared-tenant provisioning has no mandatory third-party fee. External adapters require provider accounts, credentials, approval and any provider fees; unresolved ones are reported as NOT_CONFIGURED.</p></div>
          <div className="rounded-md border border-slate-800 p-3"><p className="text-[10px] uppercase text-slate-500">Requirements classification</p><p className="mt-1 text-xs text-slate-300">Configuration only: branding, navigation, fields, workflows, roles, retention. Engineering: new logic, migrations, new integrations, dedicated infrastructure.</p></div>
        </div>
        <Notice tone="warn">No live customer data is ever copied from one company into another. A reused definition produces a new identity, tenant key, credentials scope, domain and data isolation.</Notice>
      </div>
      case 11: return <div className="sm:col-span-2 lg:col-span-3 space-y-3">
        <p className="text-xs text-slate-300">Validate the complete definition on the server before any row is written. This checks identity uniqueness, template approval, module dependencies, secrets, colours, custom fields and dedicated-instance authorization.</p>
        <Btn tone="primary" disabled={busy} onClick={validate}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Validate configuration</Btn>
        {preview ? <>
          <Notice tone={preview.ok ? 'good' : 'warn'}>{preview.ok ? 'Validation passed. Continue to isolated provisioning.' : `Validation failed: ${(preview.errors as string[] | undefined)?.join('; ')}`}</Notice>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="mb-1 text-[11px] font-semibold text-slate-400">Automated steps</p><ul className="space-y-1 text-[11px] text-slate-300">{(preview.automatedSteps as string[] | undefined)?.map((s) => <li key={s}>• {s}</li>)}</ul></div>
            <div><p className="mb-1 text-[11px] font-semibold text-slate-400">Manual / approval steps</p><ul className="space-y-1 text-[11px] text-slate-300">{(preview.manualSteps as string[] | undefined)?.map((s) => <li key={s}>• {s}</li>)}</ul></div>
          </div>
          {(preview.warnings as string[] | undefined)?.length ? <Notice tone="warn">{(preview.warnings as string[]).join(' ')}</Notice> : null}
        </> : <Notice>Validation has not run yet.</Notice>}
      </div>
      case 12: return <div className="sm:col-span-2 lg:col-span-3 space-y-3">
        <p className="text-xs text-slate-300">Provisioning creates the isolated company, a v1 versioned definition, grants, pinned modules, generated configuration, initialized records, registered adapters, a verified backup, health checks and an initial release. Every step result is recorded in the provisioning job.</p>
        <Btn tone="primary" disabled={busy || !preview?.ok} onClick={provision}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />} Provision company</Btn>
        {result ? <>
          <Notice tone={result.ok ? 'good' : 'warn'}>{result.ok ? `Provisioned ${result.companyId} → ${result.applicationId}. Status: ${result.status}.` : `Provisioning finished with failures: ${(result.errors as string[] | undefined)?.join('; ')}`}</Notice>
          <div className="grid gap-1.5 sm:grid-cols-2">{(result.steps as Row[] | undefined)?.map((s) => (
            <div key={s.key} className="flex items-start gap-2 rounded-md border border-slate-800 px-2.5 py-1.5 text-[11px]">
              <Pill status={s.status} /><span className="text-slate-300">{s.label}</span>
              <span className="ml-auto max-w-[55%] truncate text-[10px] text-slate-500" title={s.detail}>{s.detail}</span>
            </div>
          ))}</div>
        </> : <Notice>Validation must pass before provisioning is enabled.</Notice>}
      </div>
      case 13: return <div className="sm:col-span-2 lg:col-span-3 space-y-3">
        <p className="text-xs text-slate-300">Review the real result, then submit for authorization and activate. Activation requires passed tests, a verified backup, health, an authorized approval and (for dedicated instances) recorded infrastructure evidence.</p>
        {result ? <>
          <JsonBlock value={{ companyId: result.companyId, applicationId: result.applicationId, jobId: result.jobId, status: result.status, health: result.health?.status ?? 'see job steps' }} maxHeight={130} />
          {result.ok ? <div className="flex flex-wrap gap-2">
            <Btn disabled={busy} onClick={() => transition('submit')}>Submit for approval</Btn>
            <Btn tone="primary" disabled={busy} onClick={() => transition('activate')}>Approve &amp; activate</Btn>
          </div> : <Notice tone="warn">Provisioning did not pass; correct the configuration and repeat from step 11.</Notice>}
        </> : <Notice tone="warn">No provisioning result yet. Complete step 13 first.</Notice>}
      </div>
      case 14: return <div className="sm:col-span-2 lg:col-span-3 space-y-3">
        <p className="text-xs text-slate-300">The new company is reachable from the Control Center. Access to private business data requires an explicit company grant; the provisioning operator receives a time-limited, audited grant with a recorded reason.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/#/admin" className="rounded-md border border-[#009FE3]/40 bg-[#009FE3]/10 px-3 py-2 text-xs text-[#009FE3]">Open admin console → Product Factory → Software Factory Control Center</a>
          <a href="/admin/factory-control" target="_blank" rel="noreferrer" className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200">Open direct Control Center</a>
          {result?.companyId ? <a href={`/api/factory/companies/${result.companyId}`} target="_blank" rel="noreferrer" className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200">Company registry API detail</a> : null}
        </div>
        <Notice tone="warn">Company users are created as explicit, company-scoped grants, not as shared platform accounts. To let a company administrator sign in independently, an operator must create a platform user and bind its email to the company grant; this is a manual identity step, documented in `docs/SFCC_OPERATIONS.md`.</Notice>
        <Btn onClick={onDone}><ArrowLeft className="size-3.5" /> Finish and return to registry</Btn>
      </div>
      default: return null
    }
  })()

  return (
    <div className="space-y-4">
      <Panel title={`Create New Company — step ${step + 1} of 15: ${STEPS[step]}`}
        description="Select a template → configure → select modules → validate → provision → test → approve → deploy → monitor."
        actions={<Btn onClick={onDone} tone="ghost"><ArrowLeft className="size-3.5" /> Back to registry</Btn>}>
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((label, i) => (
            <button key={label} onClick={() => setStep(i)} title={label}
              className={`flex size-7 items-center justify-center rounded-md border text-[10px] font-semibold ${i === step ? 'border-[#009FE3]/60 bg-[#009FE3]/10 text-[#009FE3]' : i < step ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-800 text-slate-500'}`}>
              {i + 1}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{STEPS[step]}</p>
        {error ? <div className="mt-3"><Notice tone="warn">{error}</Notice></div> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{content}</div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
          <Btn disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="size-3.5" /> Previous</Btn>
          <span className="text-[11px] text-slate-500">Step {step + 1} of {STEPS.length}</span>
          <Btn disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>Next <ArrowRight className="size-3.5" /></Btn>
        </div>
      </Panel>
    </div>
  )
}

function split(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

function dedupeModules(rows: Row[]): Row[] {
  const map = new Map<string, Row>()
  for (const row of rows) {
    const key = String(row.moduleId)
    const prev = map.get(key)
    if (!prev || (row.required === true && prev.required !== true)) map.set(key, row)
  }
  return [...map.values()]
}
