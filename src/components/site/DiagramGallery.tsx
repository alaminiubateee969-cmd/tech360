'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, Copy, Download, Search } from 'lucide-react'
import {
  PortalSignInSequence, LeadFunnel, ProjectSwimlane,
} from './diagram-kit'
import {
  DevLifecycleDiagram, QualityChecklistDiagram, TechStackDiagram,
  CloudArchitectureDiagram, SecurityArchitectureDiagram,
  AutomationWorkflowDiagram, FeaturesModulesDiagram, DeliveryHandoverDiagram,
} from './diagrams'

// Searchable/filterable diagram gallery with working copy-SVG and
// download-SVG actions. Every diagram is an accessible SVG
// (<title>/<desc> via the diagram kit), rendered live from the
// same components the site ships — no static screenshots.

interface Entry { id: string; label: string; category: string; blurb: string; node: () => React.JSX.Element }
const ENTRIES: Entry[] = [
  { id: 'portal-sign-in', label: 'Portal sign-in sequence', category: 'Flow', blurb: 'Browser, portal and session steps for a client sign-in.', node: () => <PortalSignInSequence /> },
  { id: 'lead-funnel', label: 'Lead funnel', category: 'Flow', blurb: 'Pipeline stages from first contact to handover.', node: () => <LeadFunnel /> },
  { id: 'project-swimlane', label: 'Project swimlane', category: 'Flow', blurb: 'Who does what, in order, across client and Tech360 lanes.', node: () => <ProjectSwimlane /> },
  { id: 'dev-lifecycle', label: 'Development lifecycle', category: 'Process', blurb: 'From brief to release with review gates.', node: () => <DevLifecycleDiagram /> },
  { id: 'quality-checklist', label: 'Quality checklist', category: 'Quality', blurb: 'Checks that must pass before anything ships.', node: () => <QualityChecklistDiagram /> },
  { id: 'tech-stack', label: 'Tech stack', category: 'Architecture', blurb: 'The layers the platform is built from.', node: () => <TechStackDiagram /> },
  { id: 'cloud-architecture', label: 'Cloud architecture', category: 'Architecture', blurb: 'Hosting, data and delivery topology.', node: () => <CloudArchitectureDiagram /> },
  { id: 'security-architecture', label: 'Security architecture', category: 'Architecture', blurb: 'Access control, audit and protection layers.', node: () => <SecurityArchitectureDiagram /> },
  { id: 'automation-workflow', label: 'Automation workflow', category: 'Process', blurb: 'How approved automations run end to end.', node: () => <AutomationWorkflowDiagram /> },
  { id: 'features-modules', label: 'Features & modules', category: 'Architecture', blurb: 'The platform module map.', node: () => <FeaturesModulesDiagram /> },
  { id: 'delivery-handover', label: 'Delivery & handover', category: 'Process', blurb: 'Release, training and handover steps.', node: () => <DeliveryHandoverDiagram /> },
]
const CATEGORIES = ['All', ...Array.from(new Set(ENTRIES.map((e) => e.category)))]

function GalleryCard({ entry }: { entry: Entry }) {
  const ref = useRef<HTMLDivElement>(null)
  const [done, setDone] = useState<'copy' | 'download' | null>(null)

  const svgMarkup = (): string | null => {
    const svg = ref.current?.querySelector('svg')
    if (!svg) return null
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    return new XMLSerializer().serializeToString(clone)
  }
  const flash = (kind: 'copy' | 'download') => { setDone(kind); setTimeout(() => setDone(null), 1600) }

  const copy = async () => {
    const markup = svgMarkup()
    if (!markup) return
    try { await navigator.clipboard.writeText(markup); flash('copy') } catch { /* clipboard unavailable */ }
  }
  const download = () => {
    const markup = svgMarkup()
    if (!markup) return
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${entry.id}.svg`
    a.click()
    URL.revokeObjectURL(url)
    flash('download')
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[#0B1F33]">{entry.label}</p>
        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">{entry.category}</span>
        <span className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => void copy()} aria-label={`Copy SVG markup for ${entry.label}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:border-[#009FE3] hover:text-[#009FE3]">
            {done === 'copy' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done === 'copy' ? 'Copied' : 'Copy SVG'}
          </button>
          <button type="button" onClick={download} aria-label={`Download ${entry.label} as an SVG file`}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:border-[#009FE3] hover:text-[#009FE3]">
            {done === 'download' ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />} SVG
          </button>
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{entry.blurb}</p>
      <div ref={ref} className="mt-4 w-full overflow-x-auto">{entry.node()}</div>
    </div>
  )
}

export function DiagramGallery() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const list = useMemo(() => ENTRIES.filter((e) =>
    (category === 'All' || e.category === category) &&
    (`${e.label} ${e.blurb} ${e.category}`.toLowerCase().includes(query.trim().toLowerCase())),
  ), [query, category])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search diagrams…"
            aria-label="Search diagrams"
            className="min-h-10 w-64 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#009FE3]"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Diagram categories">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={category === c} onClick={() => setCategory(c)}
              className={`min-h-9 rounded-full border px-3 text-xs font-medium ${category === c ? 'border-[#009FE3] bg-[#009FE3]/10 text-[#0077aa]' : 'border-slate-300 text-slate-500 hover:text-slate-800'}`}>
              {c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-500" aria-live="polite">{list.length} of {ENTRIES.length} diagrams</span>
      </div>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No diagrams match that search. Try a different term or category.</p>
      ) : (
        <div className="grid gap-4">{list.map((e) => <GalleryCard key={e.id} entry={e} />)}</div>
      )}
    </div>
  )
}
