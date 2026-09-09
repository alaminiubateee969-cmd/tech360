'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { SCROLL_THIN } from './styles'

function tokenize(src: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) nodes.push(src.slice(last, m.index))
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        nodes.push(
          <span key={`k-${key++}`} className="text-sky-300">
            {m[1]}
          </span>,
          <span key={`c-${key++}`} className="text-slate-500">
            {m[2]}
          </span>,
        )
      } else {
        nodes.push(
          <span key={`s-${key++}`} className="text-emerald-300">
            {m[1]}
          </span>,
        )
      }
    } else if (m[3] !== undefined) {
      nodes.push(
        <span key={`b-${key++}`} className="text-purple-300">
          {m[3]}
        </span>,
      )
    } else if (m[4] !== undefined) {
      nodes.push(
        <span key={`n-${key++}`} className="text-amber-300">
          {m[4]}
        </span>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < src.length) nodes.push(src.slice(last))
  return nodes
}

/** Minimal syntax-colored JSON (or raw text) viewer. */
export function JsonView({
  value,
  className,
  maxHeightClass = 'max-h-96',
}: {
  value: unknown
  className?: string
  maxHeightClass?: string
}) {
  let text: string
  if (typeof value === 'string') text = value
  else {
    try {
      text = JSON.stringify(value, null, 2)
    } catch {
      text = String(value)
    }
  }
  return (
    <pre
      className={cn(
        'overflow-auto rounded-md border border-slate-800 bg-slate-950/70 p-3 font-mono text-[11px] leading-relaxed text-slate-400',
        maxHeightClass,
        SCROLL_THIN,
        className,
      )}
    >
      {tokenize(text)}
    </pre>
  )
}
