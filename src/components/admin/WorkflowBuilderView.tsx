'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GitBranch, Loader2, Plus, RefreshCw, Save, Trash2, XCircle } from 'lucide-react'

import { fetchJson, useApi } from '@/lib/admin-client'
import { EmptyState, KpiCard, PageHeader, SectionCard } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { CARD, INPUT, MONO } from './shared/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// ============================================================
// WORKFLOW BUILDER
//
// The diagram is REAL persisted data: it is saved to the database and
// reloaded from it. A draft can never be executed; only a PUBLISHED
// workflow is eligible to run.
//
// The editor is deliberately simple and honest — a node list plus an
// edge list. The diagram is laid out automatically from the graph, so
// what you see is exactly what was stored.
// ============================================================

type NodeKind = 'TRIGGER' | 'AGENT' | 'SKILL' | 'APPROVAL' | 'TOOL' | 'NOTIFY' | 'WAIT' | 'END'
type WorkflowNode = { id: string; kind: NodeKind; label: string; binding: string; requiresApproval?: boolean }
type WorkflowEdge = { id: string; from: string; to: string; label?: string }

type Workflow = {
  id: string
  key: string
  name: string
  description: string | null
  version: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  updatedAt: string
}

type WorkflowsResponse = { workflows: Workflow[]; total: number }

const KIND_ORDER: NodeKind[] = ['TRIGGER', 'AGENT', 'SKILL', 'APPROVAL', 'TOOL', 'NOTIFY', 'WAIT', 'END']
const KIND_COLOR: Record<NodeKind, string> = {
  TRIGGER: '#18B83A',
  AGENT: '#009FE3',
  SKILL: '#A78BFA',
  APPROVAL: '#F59E0B',
  TOOL: '#38BDF8',
  NOTIFY: '#34D399',
  WAIT: '#94A3B8',
  END: '#EF4444',
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export default function WorkflowBuilderView() {
  const { data, loading, error, refresh } = useApi<WorkflowsResponse>('/api/admin/workflows')
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [edges, setEdges] = useState<WorkflowEdge[]>([])
  const [saving, setSaving] = useState(false)
  const [loadedFrom, setLoadedFrom] = useState<string>('')

  const workflows = data?.workflows ?? []

  const load = useCallback((workflow: Workflow) => {
    setSelectedKey(workflow.key)
    setKey(workflow.key)
    setName(workflow.name)
    setDescription(workflow.description ?? '')
    setStatus(workflow.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT')
    setNodes(workflow.nodes.map((node) => ({ ...node })))
    setEdges(workflow.edges.map((edge) => ({ ...edge })))
    setLoadedFrom(workflow.updatedAt)
  }, [])

  useEffect(() => {
    if (workflows.length === 0 || selectedKey) return
    load(workflows[0])
  }, [workflows, selectedKey, load])

  function startNew() {
    setSelectedKey('')
    setKey('')
    setName('')
    setDescription('')
    setStatus('DRAFT')
    setNodes([
      { id: newId('trigger'), kind: 'TRIGGER', label: 'When a new lead arrives', binding: 'crm.lead.created' },
      { id: newId('end'), kind: 'END', label: 'Finish', binding: '' },
    ])
    setEdges([
      { id: newId('edge'), from: 'trigger_pending', to: 'end_pending' },
    ])
    setLoadedFrom('')
  }

  function addNode(kind: NodeKind) {
    const node: WorkflowNode = {
      id: newId(kind.toLowerCase()),
      kind,
      label: `New ${kind.toLowerCase()} node`,
      binding: '',
      requiresApproval: kind === 'APPROVAL' || kind === 'NOTIFY',
    }
    setNodes((current) => [...current, node])
  }

  function updateNode(id: string, patch: Partial<WorkflowNode>) {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)))
  }

  function removeNode(id: string) {
    setNodes((current) => current.filter((node) => node.id !== id))
    setEdges((current) => current.filter((edge) => edge.from !== id && edge.to !== id))
  }

  function addEdge() {
    const from = nodes[0]?.id
    const to = nodes[nodes.length - 1]?.id
    if (!from || !to || from === to) return
    setEdges((current) => [...current, { id: newId('edge'), from, to }])
  }

  async function save() {
    if (!key.trim() || !name.trim()) {
      toast.error('A workflow needs a key and a name.')
      return
    }
    setSaving(true)
    try {
      const result = await fetchJson<{ workflow?: Workflow; error?: string; issues?: string[] }>(
        '/api/admin/workflows',
        { method: 'POST', body: { key: key.trim(), name: name.trim(), description, status, nodes, edges } },
      )
      if (result.workflow) {
        load(result.workflow)
        toast.success(`Saved "${result.workflow.name}" as version ${result.workflow.version}.`)
        refresh()
      } else {
        toast.error(result.error ?? 'The workflow could not be saved.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The workflow could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  // Automatic layout: nodes are placed in columns by their kind so the
  // diagram always reflects the stored graph exactly.
  const layout = useMemo(() => {
    const columns: NodeKind[] = KIND_ORDER.filter((kind) => nodes.some((node) => node.kind === kind))
    const positions = new Map<string, { x: number; y: number }>()
    columns.forEach((kind, columnIndex) => {
      const column = nodes.filter((node) => node.kind === kind)
      column.forEach((node, rowIndex) => {
        positions.set(node.id, { x: 40 + columnIndex * 190, y: 40 + rowIndex * 76 })
      })
    })
    return { columns, positions }
  }, [nodes])

  const invalid = useMemo(() => {
    const issues: string[] = []
    if (nodes.length === 0) issues.push('a workflow needs at least one node')
    if (nodes.filter((n) => n.kind === 'TRIGGER').length !== 1) issues.push('a workflow needs exactly one TRIGGER node')
    if (!nodes.some((n) => n.kind === 'END')) issues.push('a workflow needs an END node')
    const ids = new Set(nodes.map((n) => n.id))
    for (const edge of edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) issues.push(`edge "${edge.id}" points at a missing node`)
    }
    return issues
  }, [nodes, edges])

  return (
    <div>
      <PageHeader
        title="Workflow Builder"
        description="Design a workflow diagram, save it, and reload it. Only a PUBLISHED workflow is eligible to run — a draft is never executed."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={startNew} aria-label="Create a new workflow">
              <Plus className="size-4" aria-hidden="true" />
              New
            </Button>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Reload workflows from the database">
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
              Reload
            </Button>
            <Button size="sm" onClick={save} disabled={saving || invalid.length > 0} aria-label="Save the workflow">
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
              Save
            </Button>
          </>
        }
      />

      {error ? <EmptyState icon={XCircle} title="Workflows could not be loaded" description={error} /> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Workflows" value={data?.total ?? '—'} icon={GitBranch} loading={loading} sub="persisted diagrams" />
        <KpiCard label="Nodes" value={nodes.length} icon={GitBranch} tone="accent" sub="in the open editor" />
        <KpiCard label="Edges" value={edges.length} icon={GitBranch} tone="slate" sub="in the open editor" />
        <KpiCard
          label="State"
          value={status}
          icon={GitBranch}
          tone={status === 'PUBLISHED' ? 'green' : 'amber'}
          sub={loadedFrom ? `loaded from the database (${new Date(loadedFrom).toLocaleString()})` : 'not yet saved'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <SectionCard title="Saved workflows" description="Click one to load it back from the database.">
          {loading && !data ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-md bg-slate-800/50" />
              ))}
            </div>
          ) : workflows.length === 0 ? (
            <EmptyState icon={GitBranch} title="No workflow saved yet" description="Create one with the New button." />
          ) : (
            <div className="space-y-1.5">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => load(workflow)}
                  className={
                    'w-full rounded-md border px-3 py-2 text-left transition ' +
                    (selectedKey === workflow.key
                      ? 'border-[#009FE3]/60 bg-[#009FE3]/10'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-200">{workflow.name}</span>
                    <StatusBadge status={workflow.status} />
                  </div>
                  <p className={MONO + ' mt-0.5 truncate'}>{workflow.key}</p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Diagram" description="The graph exactly as it is stored. Node colour is the node kind.">
            {nodes.length === 0 ? (
              <EmptyState icon={GitBranch} title="The diagram is empty" description="Add nodes from the editor below." />
            ) : (
              <div className={CARD + ' overflow-auto p-2'}>
                <svg
                  width={Math.max(720, layout.columns.length * 190 + 80)}
                  height={Math.max(180, Math.max(...Array.from(layout.positions.values()).map((p) => p.y)) + 110)}
                  role="img"
                  aria-label="Workflow diagram"
                >
                  {edges.map((edge) => {
                    const from = layout.positions.get(edge.from)
                    const to = layout.positions.get(edge.to)
                    if (!from || !to) return null
                    const x1 = from.x + 150
                    const y1 = from.y + 26
                    const x2 = to.x
                    const y2 = to.y + 26
                    return (
                      <g key={edge.id}>
                        <path
                          d={`M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke="#334155"
                          strokeWidth={1.5}
                        />
                        <circle cx={x2} cy={y2} r={3} fill="#334155" />
                      </g>
                    )
                  })}
                  {nodes.map((node) => {
                    const position = layout.positions.get(node.id)
                    if (!position) return null
                    return (
                      <g key={node.id} transform={`translate(${position.x}, ${position.y})`}>
                        <rect
                          width={150}
                          height={52}
                          rx={8}
                          fill="#0f172a"
                          stroke={KIND_COLOR[node.kind]}
                          strokeWidth={1.5}
                        />
                        <rect width={4} height={52} rx={2} fill={KIND_COLOR[node.kind]} />
                        <text x={12} y={21} fill="#e2e8f0" fontSize={11} fontFamily="ui-monospace, monospace">
                          {node.label.slice(0, 20)}
                        </text>
                        <text x={12} y={38} fill="#64748b" fontSize={9} fontFamily="ui-monospace, monospace">
                          {node.kind}
                          {node.requiresApproval ? ' · approval' : ''}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            )}
            {invalid.length > 0 ? (
              <ul className="mt-3 space-y-1 text-[11px] text-amber-400/90">
                {invalid.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          <SectionCard title="Editor" description="The nodes and edges that make up the diagram.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="wf-key">Key</Label>
                  <Input id="wf-key" value={key} onChange={(event) => setKey(event.target.value)} className="mt-1" placeholder="lead-qualification" />
                </div>
                <div>
                  <Label htmlFor="wf-name">Name</Label>
                  <Input id="wf-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1" placeholder="Lead qualification" />
                </div>
                <div>
                  <Label htmlFor="wf-description">Description</Label>
                  <textarea
                    id="wf-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    className={INPUT + ' h-auto py-2'}
                  />
                </div>
                <div>
                  <Label htmlFor="wf-status">State</Label>
                  <select
                    id="wf-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value as 'DRAFT' | 'PUBLISHED')}
                    className={INPUT + ' mt-1'}
                  >
                    <option value="DRAFT">DRAFT — not eligible to run</option>
                    <option value="PUBLISHED">PUBLISHED — eligible to run</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {KIND_ORDER.map((kind) => (
                    <Button key={kind} variant="outline" size="sm" onClick={() => addNode(kind)} aria-label={`Add a ${kind} node`}>
                      <Plus className="size-3" aria-hidden="true" />
                      {kind}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Nodes</p>
                  <Button variant="outline" size="sm" onClick={addEdge} aria-label="Add an edge">
                    <Plus className="size-3" aria-hidden="true" />
                    Edge
                  </Button>
                </div>
                {nodes.map((node) => (
                  <div key={node.id} className={CARD + ' p-2'}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: KIND_COLOR[node.kind] }}
                        aria-hidden="true"
                      />
                      <select
                        value={node.kind}
                        onChange={(event) => updateNode(node.id, { kind: event.target.value as NodeKind })}
                        aria-label={`Kind of node ${node.label}`}
                        className="h-7 rounded border border-slate-800 bg-slate-950/60 px-1 text-[11px] text-slate-300"
                      >
                        {KIND_ORDER.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={node.label}
                        onChange={(event) => updateNode(node.id, { label: event.target.value })}
                        aria-label={`Label of node ${node.id}`}
                        className="h-7 flex-1 text-[11px]"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeNode(node.id)} aria-label={`Remove node ${node.label}`}>
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                    <Input
                      value={node.binding}
                      onChange={(event) => updateNode(node.id, { binding: event.target.value })}
                      placeholder="binding — agent code, skill id, tool or channel"
                      aria-label={`Binding of node ${node.label}`}
                      className="mt-1.5 h-7 font-mono text-[11px]"
                    />
                  </div>
                ))}
                {nodes.length === 0 ? <p className="text-[11px] text-slate-500">No nodes yet.</p> : null}

                {edges.length > 0 ? (
                  <>
                    <p className="pt-2 text-[11px] uppercase tracking-wider text-slate-500">Edges</p>
                    {edges.map((edge) => (
                      <div key={edge.id} className={CARD + ' flex items-center gap-2 p-2'}>
                        <span className={MONO + ' flex-1 truncate'}>
                          {edge.from} → {edge.to}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEdges((current) => current.filter((e) => e.id !== edge.id))}
                          aria-label={`Remove edge ${edge.id}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </>
                ) : null}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
