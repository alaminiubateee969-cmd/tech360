'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Megaphone } from 'lucide-react'
import { toast } from 'sonner'

import { COMMON_FIELDS, MARKETING_TEMPLATES, fillTemplate, unfilledKeys } from '@/data/marketing-templates'
import { PageHeader, SectionCard } from './shared/cards'
import { ACCENT, INPUT } from './shared/styles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Marketing kit: pick a template, fill the blanks once, copy. Pure client-side — nothing is sent
// from here; sending goes through Communications (consent + approval gates).
// Frameworks adapted from coreyhaines31/marketingskills (MIT).

const CATEGORIES = ['All', ...Array.from(new Set(MARKETING_TEMPLATES.map((t) => t.category)))]

export function MarketingKitView() {
  const [cat, setCat] = useState('All')
  const [activeId, setActiveId] = useState(MARKETING_TEMPLATES[0].id)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(COMMON_FIELDS.map((f) => [f.key, f.default ?? ''])))
  const [copied, setCopied] = useState<string | null>(null)

  const list = useMemo(() => MARKETING_TEMPLATES.filter((t) => cat === 'All' || t.category === cat), [cat])
  const active = MARKETING_TEMPLATES.find((t) => t.id === activeId) ?? MARKETING_TEMPLATES[0]
  const subject = active.subject ? fillTemplate(active.subject, values) : ''
  const body = fillTemplate(active.body, values)
  const missing = unfilledKeys(active.body + (active.subject ?? ''), values)

  const copy = async (what: 'subject' | 'body') => {
    try {
      await navigator.clipboard.writeText(what === 'subject' ? subject : body)
      setCopied(what); setTimeout(() => setCopied(null), 1500)
    } catch { toast.error('Copy failed — select the text and copy manually.') }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing Kit"
        description="Ready-to-edit outreach, website, social and retention templates built on proven copy frameworks. Fill the details once; every template updates. Nothing is sent from here — use Communications for consented, approved sending."
      />
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Template categories">
        {CATEGORIES.map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
            className={cn('min-h-9 rounded-full border px-3 text-xs font-medium transition-colors', cat === c ? 'border-[#009FE3] bg-[#009FE3]/15 text-[#7fd4ff]' : 'border-slate-800 text-slate-400 hover:text-slate-200')}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-4">
          <SectionCard title="Templates">
            <ul className="space-y-1">
              {list.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setActiveId(t.id)} aria-current={t.id === active.id}
                    className={cn('w-full rounded-md px-2.5 py-2 text-left transition-colors', t.id === active.id ? 'bg-[#009FE3]/15' : 'hover:bg-slate-800/60')}>
                    <span className="block text-sm font-medium text-slate-200">{t.title}</span>
                    <span className="block text-[11px] text-slate-500">{t.channel} · {t.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title="Your details" description="Used in every template">
            <div className="space-y-2">
              {COMMON_FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`mk-${f.key}`} className="mb-1 block text-[11px] text-slate-500">{f.label}</label>
                  <input id={`mk-${f.key}`} className={INPUT} value={values[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title={<span className="flex items-center gap-2"><Megaphone className="size-4" style={{ color: ACCENT }} /> {active.title}</span>}
          description={<>Framework: <strong className="text-slate-300">{active.framework}</strong> — {active.when}</>}
        >
          {subject ? (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <p className="min-w-0 break-words text-sm text-slate-200"><span className="mr-2 text-[11px] uppercase tracking-wider text-slate-500">Subject</span>{subject}</p>
              <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={() => copy('subject')}>{copied === 'subject' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy</Button>
            </div>
          ) : null}
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-800 bg-slate-950/60 p-4 font-sans text-sm leading-relaxed text-slate-200">{body}</pre>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className={cn('text-xs', missing.length ? 'text-amber-400' : 'text-emerald-400')}>
              {missing.length ? `Still to fill: ${missing.map((m) => COMMON_FIELDS.find((f) => f.key === m)?.label ?? m).join(', ')}` : 'All placeholders filled'}
            </p>
            <Button size="sm" className="h-9 gap-1.5" style={{ backgroundColor: ACCENT }} onClick={() => copy('body')}>
              {copied === 'body' ? <Check className="size-4" /> : <Copy className="size-4" />} Copy message
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
