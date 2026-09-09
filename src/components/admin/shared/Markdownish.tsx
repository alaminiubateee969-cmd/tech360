'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Inline: **bold** and `code`
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.filter(Boolean).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-slate-100">
          {p.slice(2, -2)}
        </strong>
      )
    }
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
      return (
        <code
          key={`${keyPrefix}-c-${i}`}
          className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[11px] text-[#009FE3]"
        >
          {p.slice(1, -1)}
        </code>
      )
    }
    return <span key={`${keyPrefix}-t-${i}`}>{p}</span>
  })
}

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; lines: string[] }
  | { kind: 'hr' }

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing fence
      blocks.push({ kind: 'code', lines: codeLines })
      continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      blocks.push({ kind: 'h', level: h[1].length, text: h[2] })
      i++
      continue
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ol', items })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    blocks.push({ kind: 'p', text: line })
    i++
  }
  return blocks
}

/** Markdown-ish renderer: headings, bold, inline code, lists, code fences, hr. */
export function Markdownish({ text, className }: { text?: string | null; className?: string }) {
  if (!text || !text.trim()) return <p className="text-sm text-slate-500">—</p>
  const blocks = parseBlocks(text)
  return (
    <div className={cn('space-y-2.5 text-sm leading-relaxed text-slate-300', className)}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h': {
            if (b.level <= 1)
              return (
                <h2 key={i} className="pt-1 text-base font-bold text-slate-100">
                  {renderInline(b.text, `h${i}`)}
                </h2>
              )
            if (b.level === 2)
              return (
                <h3 key={i} className="pt-1 text-sm font-bold uppercase tracking-wide text-slate-400">
                  {renderInline(b.text, `h${i}`)}
                </h3>
              )
            return (
              <h4 key={i} className="pt-1 text-sm font-semibold text-slate-200">
                {renderInline(b.text, `h${i}`)}
              </h4>
            )
          }
          case 'p':
            return <p key={i}>{renderInline(b.text, `p${i}`)}</p>
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `ul${i}-${j}`)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `ol${i}-${j}`)}</li>
                ))}
              </ol>
            )
          case 'code':
            return (
              <pre
                key={i}
                className="overflow-x-auto rounded-md border border-slate-800 bg-slate-950/70 p-3 font-mono text-[11px] leading-relaxed text-slate-400"
              >
                {b.lines.join('\n')}
              </pre>
            )
          case 'hr':
            return <hr key={i} className="border-slate-800" />
          default:
            return null
        }
      })}
    </div>
  )
}
