'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Check, Layers, X } from 'lucide-react'

import { Reveal, RevealItem, RevealList } from './Reveal'
import {
  WORK_CATEGORIES,
  WORK_EXAMPLES,
  WORK_EXAMPLE_NOTICE,
  filterWorkExamples,
  type WorkCategory,
  type WorkExample,
} from '@/data/work-examples'

/**
 * Premium work-example gallery.
 *
 * Behaviour:
 *  - Category filter chips (keyboard accessible, `aria-pressed`).
 *  - Asymmetric grid: the first card spans two columns on large screens.
 *  - Every card opens an accessible detail dialog (Escape, backdrop click,
 *    focus return to the triggering card).
 *  - Images are plain <img> with explicit dimensions-agnostic aspect boxes and
 *    lazy loading, so the section never blocks first paint or shifts layout.
 *  - The honesty notice is rendered in the section, not only inside dialogs.
 */
export function WorkExamples({ headingLevel = 'h2' }: { headingLevel?: 'h2' | 'h3' }) {
  const [category, setCategory] = useState<'All' | WorkCategory>('All')
  const [active, setActive] = useState<WorkExample | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const examples = useMemo(() => filterWorkExamples(category), [category])

  const Heading = headingLevel

  return (
    <section aria-labelledby="work-examples-heading" className="relative bg-[#071528]">
      {/* Subtle depth wash — no layout impact */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_0%,rgba(0,159,227,0.18),transparent_55%),radial-gradient(90%_70%_at_85%_10%,rgba(124,92,255,0.14),transparent_60%)]"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8FD3F4]">
              <Layers className="size-3.5" aria-hidden="true" />
              What we build
            </p>
            <Heading
              id="work-examples-heading"
              className="mt-5 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]"
            >
              Twelve production-grade systems, shown as concept previews
            </Heading>
            <p className="mt-4 text-base leading-relaxed text-[#A9BED2]">
              Each example describes a system Tech360 can deliver — its modules, integrations and the capabilities it is
              designed to provide. Scope, provider configuration and acceptance criteria are agreed per engagement.
            </p>
          </div>
        </Reveal>

        {/* Honesty notice — always visible */}
        <Reveal delay={0.05}>
          <p className="mt-6 max-w-3xl rounded-xl border border-[#009FE3]/25 bg-[#009FE3]/[0.07] px-4 py-3 text-sm leading-relaxed text-[#BCD6EA]">
            <span className="font-semibold text-white">How to read this gallery:</span> {WORK_EXAMPLE_NOTICE}
          </p>
        </Reveal>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter work examples by category">
          {WORK_CATEGORIES.map((item) => {
            const selected = category === item
            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(item)}
                className={[
                  'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none',
                  'focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071528]',
                  selected
                    ? 'border-[#009FE3] bg-[#009FE3] text-[#04121F]'
                    : 'border-white/15 bg-white/[0.04] text-[#A9BED2] hover:border-white/30 hover:text-white',
                ].join(' ')}
              >
                {item}
              </button>
            )
          })}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {examples.length} of {WORK_EXAMPLES.length} examples shown.
        </p>

        {/* Asymmetric grid */}
        <RevealList className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((example, index) => {
            const featured = category === 'All' && index === 0
            return (
              <RevealItem
                key={example.slug}
                className={featured ? 'h-full sm:col-span-2 lg:col-span-2' : 'h-full'}
              >
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0B2138] shadow-[0_18px_50px_rgba(2,10,20,0.45)] transition-all duration-300 hover:border-[#009FE3]/50 hover:shadow-[0_24px_60px_rgba(0,159,227,0.18)]">
                  <button
                    type="button"
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget
                      setActive(example)
                    }}
                    aria-label={`Open details for ${example.name}`}
                    className="flex h-full flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B2138]"
                  >
                    <div className={featured ? 'relative aspect-[16/9] w-full overflow-hidden' : 'relative aspect-[16/10] w-full overflow-hidden'}>
                      <img
                        src={example.image}
                        alt={example.imageAlt}
                        loading={index < 3 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-[#0B2138] via-[#0B2138]/25 to-transparent"
                      />
                      <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-[#071528]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8FD3F4] backdrop-blur">
                        {example.category} · concept
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className={
                            featured
                              ? 'text-xl font-semibold leading-snug text-white sm:text-2xl'
                              : 'text-lg font-semibold leading-snug text-white'
                          }
                        >
                          {example.name}
                        </h3>
                        <ArrowUpRight
                          className="mt-1 size-4 shrink-0 text-[#7FA5BF] transition-colors group-hover:text-[#009FE3]"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="text-sm leading-relaxed text-[#A9BED2]">{example.tagline}</p>

                      <ul className="mt-auto flex flex-wrap gap-1.5 pt-2" aria-label={`${example.name} modules`}>
                        {example.modules.slice(0, featured ? 6 : 3).map((module) => (
                          <li
                            key={module}
                            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-[#BCD6EA]"
                          >
                            {module}
                          </li>
                        ))}
                        {!featured && example.modules.length > 3 && (
                          <li className="rounded-md border border-[#009FE3]/30 px-2 py-1 text-[11px] font-medium text-[#8FD3F4]">
                            +{example.modules.length - 3} more
                          </li>
                        )}
                      </ul>

                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#8FD3F4]">
                        View system detail
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                </article>
              </RevealItem>
            )
          })}
        </RevealList>

        {examples.length === 0 && (
          <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-[#A9BED2]">
            No examples in this category yet.
          </p>
        )}
      </div>

      <WorkExampleDialog
        example={active}
        onClose={() => {
          setActive(null)
          // Return focus to the card that opened the dialog.
          requestAnimationFrame(() => triggerRef.current?.focus())
        }}
      />
    </section>
  )
}

function WorkExampleDialog({ example, onClose }: { example: WorkExample | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const open = example !== null

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!example) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-example-dialog-title"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#04121F]/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92svh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0B2138] shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          <img src={example.image} alt={example.imageAlt} className="aspect-[16/9] w-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0B2138] via-transparent to-transparent" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close example detail"
            className="absolute right-3 top-3 rounded-full border border-white/20 bg-[#071528]/85 p-2 text-white outline-none backdrop-blur transition-colors hover:bg-[#071528] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8FD3F4]">
            {example.category} · concept showcase
          </p>
          <h2 id="work-example-dialog-title" className="mt-2 text-2xl font-bold text-white">
            {example.name}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#A9BED2]">{example.description}</p>

          <DetailBlock title="Capabilities" items={example.capabilities} tone="positive" />
          <DetailBlock title="Core modules" items={example.modules} />
          <DetailBlock title="Typical integrations" items={example.integrations} />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7FA5BF]">Indicative build window</p>
              <p className="mt-1 text-sm font-semibold text-white">{example.deliveryWeeks}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A9BED2]">
                Planning estimate only; confirmed after scope agreement.
              </p>
            </div>
            <div className="rounded-xl border border-[#B4472A]/30 bg-[#B4472A]/[0.08] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#EFA88F]">Not claimed</p>
              <ul className="mt-2 space-y-1.5">
                {example.outOfScope.map((item) => (
                  <li key={item} className="text-xs leading-relaxed text-[#F0C7B8]">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-[#7FA5BF]">
            {WORK_EXAMPLE_NOTICE}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="#/contact"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg bg-[#009FE3] px-4 py-2.5 text-sm font-semibold text-[#04121F] outline-none transition-colors hover:bg-[#33B5EA] focus-visible:ring-2 focus-visible:ring-white"
            >
              Discuss this system
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#009FE3]"
            >
              Back to gallery
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailBlock({
  title,
  items,
  tone = 'default',
}: {
  title: string
  items: string[]
  tone?: 'default' | 'positive'
}) {
  return (
    <div className="mt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7FA5BF]">{title}</h3>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-[#BCD6EA]">
            <Check
              className={tone === 'positive' ? 'mt-0.5 size-3.5 shrink-0 text-[#18B83A]' : 'mt-0.5 size-3.5 shrink-0 text-[#009FE3]'}
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default WorkExamples
