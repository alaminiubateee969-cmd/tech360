'use client'

import { useMemo, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, GripVertical, Mail, Phone, Building2, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

import { fmtDateShort } from '@/lib/admin-client'
import { StatusBadge } from './shared/StatusBadge'
import { Button } from '@/components/ui/button'

type BoardRow = {
  id: string
  clientId: string
  name: string
  businessName?: string | null
  businessType?: string | null
  email?: string | null
  whatsapp?: string | null
  source?: string | null
  pipelineStage: string
  status: string
  score: number
  createdAt: string
  updatedAt: string
}

const STAGES_ORDERED = [
  'NEW', 'CONTACTED', 'BUSINESS_IDENTIFIED', 'PLAN_RECOMMENDED', 'SCOPE_COLLECTION',
  'SCOPE_REVIEW', 'FINAL_SCOPE', 'CLIENT_APPROVAL', 'PAYMENT_PENDING', 'PROJECT_ACTIVE',
  'DEVELOPMENT', 'CLIENT_REVIEW', 'FINAL_PAYMENT', 'DELIVERY', 'HANDOVER',
  'PASSWORD_CHANGE', 'REVIEW_REQUESTED', 'REFERRAL_REQUESTED', 'COMPLETED', 'CLOSED',
] as const

const pretty = (s: string) =>
  s.toLowerCase().split(/[_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

function priorityFromScore(score: number): { label: string; tone: string } {
  if (score >= 70) return { label: 'High', tone: 'bg-red-500/15 text-red-400 border-red-500/30' }
  if (score >= 40) return { label: 'Medium', tone: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
  if (score > 0) return { label: 'Low', tone: 'bg-slate-700 text-slate-300 border-slate-600' }
  return { label: '—', tone: 'bg-slate-800 text-slate-500 border-slate-700' }
}

function LeadCard({ row, onOpen }: { row: BoardRow; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, data: { row } })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const prio = priorityFromScore(row.score ?? 0)
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-sm transition hover:border-[#009FE3]/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{row.name}</p>
          <p className="truncate text-xs text-slate-400 flex items-center gap-1"><Building2 className="size-3 shrink-0" />{row.businessName || row.businessType || '—'}</p>
        </div>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${row.clientId}`}
          className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="font-mono text-[10px] text-[#009FE3]">{row.clientId}</span>
        <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${prio.tone}`}>{prio.label}</span>
      </div>
      <div className="mt-2 space-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><Mail className="size-3" />{row.email || '—'}</span>
        <span className="flex items-center gap-1.5"><Phone className="size-3" />{row.whatsapp || '—'}</span>
        <span className="flex items-center gap-1.5"><Clock className="size-3" />{fmtDateShort(row.updatedAt)} · {row.source || 'WEBSITE'}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusBadge status={row.pipelineStage} />
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-[#009FE3] hover:bg-[#009FE3]/10" onClick={() => onOpen(row.id)} aria-label={`View ${row.clientId}`}>
          <Eye className="size-3.5" /> View
        </Button>
      </div>
    </div>
  )
}

function Column({ stage, rows, onOpen }: { stage: string; rows: BoardRow[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } })
  return (
    <div
      ref={setNodeRef}
      className={`flex w-[300px] shrink-0 flex-col rounded-xl border bg-slate-950/60 ${isOver ? 'border-[#009FE3]/60 bg-[#009FE3]/5' : 'border-slate-800'}`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2.5 backdrop-blur">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-200">{pretty(stage)}</h3>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-300">{rows.length}</span>
      </div>
      <SortableContext id={stage} items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: '65vh' }}>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-500">Drop here to move to {pretty(stage)}</p>
          ) : (
            rows.map((r) => <LeadCard key={r.id} row={r} onOpen={onOpen} />)
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export function LeadsBoard({
  rows,
  onOpenClient,
  onMoved,
}: {
  rows: BoardRow[]
  onOpenClient: (id: string) => void
  onMoved: () => void
}) {
  const [activeRow, setActiveRow] = useState<BoardRow | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const grouped = useMemo(() => {
    const map = new Map<string, BoardRow[]>()
    for (const s of STAGES_ORDERED) map.set(s, [])
    for (const r of rows) {
      const arr = map.get(r.pipelineStage) ?? []
      arr.push(r)
      map.set(r.pipelineStage, arr)
    }
    // sort within column by updatedAt desc
    for (const [k, v] of map) v.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return map
  }, [rows])

  const handleStart = (e: DragStartEvent) => {
    const row = (e.active.data.current?.row as BoardRow | undefined) ?? rows.find((r) => r.id === String(e.active.id)) ?? null
    setActiveRow(row)
  }

  const handleEnd = async (e: DragEndEvent) => {
    setActiveRow(null)
    const activeId = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    if (!overId) return

    // Resolve target stage: over.id may be a stage id (column) or a card id
    let targetStage: string | null = null
    if (STAGES_ORDERED.includes(overId as (typeof STAGES_ORDERED)[number])) {
      targetStage = overId
    } else {
      const overRow = rows.find((r) => r.id === overId)
      if (overRow) targetStage = overRow.pipelineStage
    }
    if (!targetStage) return

    const dragged = rows.find((r) => r.id === activeId)
    if (!dragged) return
    if (dragged.pipelineStage === targetStage) return

    // optimistic guard: prevent duplicate submission
    if (movingId) return
    setMovingId(activeId)
    try {
      const res = await fetch(`/api/admin/clients/${encodeURIComponent(activeId)}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStage: targetStage }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; pipelineStage?: string }
      if (!res.ok) throw new Error(data.error || data.message || `Move failed (${res.status})`)
      toast.success(data.message || `Moved to ${pretty(targetStage)}`)
      onMoved()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Move failed'
      toast.error(msg)
    } finally {
      setMovingId(null)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
        <AlertCircle className="mx-auto size-6 text-slate-600" />
        <p className="mt-2 text-sm font-medium text-slate-300">No records match these filters</p>
        <p className="mt-1 text-xs text-slate-500">Try clearing the search or broadening the stage filter — board shows up to 100 records.</p>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleStart} onDragEnd={handleEnd}>
      <div className="overflow-x-auto pb-2" role="region" aria-label="Leads Kanban board — drag cards between stages, or use View to open client">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {STAGES_ORDERED.map((stage) => (
            <Column key={stage} stage={stage} rows={grouped.get(stage) ?? []} onOpen={onOpenClient} />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeRow ? (
          <div className="w-[300px] rotate-2 rounded-xl border border-[#009FE3]/40 bg-slate-900 p-3 shadow-xl">
            <p className="text-sm font-semibold text-slate-100">{activeRow.name}</p>
            <p className="text-xs text-slate-400">{activeRow.clientId} · {pretty(activeRow.pipelineStage)}</p>
          </div>
        ) : null}
      </DragOverlay>
      <p className="mt-2 text-xs text-slate-500">Tip: Drag a card to another column to change its stage. STAFF can move forward one stage; MANAGER+ can correct forward/backward. Every move is audit-logged.</p>
    </DndContext>
  )
}
