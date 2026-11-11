#!/usr/bin/env node
/**
 * TECH360 — regenerates the seven product illustrations in `public/images/`.
 *
 * WHY THIS EXISTS
 * Seven shipped PNGs contained Chinese-language placeholder text (and misspelled
 * labels), so every surface that embedded them displayed non-English copy on an
 * English-only website. They are replaced here by diagrams drawn in SVG from the
 * brand palette and rendered with `sharp`, which guarantees:
 *
 *   - English-only labels (the text is in this file, not in a bitmap)
 *   - the exact pixel dimensions the layouts already expect
 *   - no photographic claims: these are labelled interface illustrations
 *
 * USAGE
 *   node scripts/generate-site-illustrations.mjs [--check]
 *
 * `--check` regenerates into memory and asserts the committed files match the
 * current source of truth, so CI can catch a hand-edited binary.
 */
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'images')

const C = {
  navy: '#063B8F',
  ink: '#0B1F33',
  cyan: '#009FE3',
  cyanSoft: '#E3F4FD',
  green: '#18B83A',
  greenSoft: '#E8F8EC',
  amber: '#F59E0B',
  amberSoft: '#FEF3E2',
  red: '#EF4444',
  slate: '#526173',
  slateSoft: '#F2F6FA',
  line: '#E2E8F0',
  white: '#FFFFFF',
  page: '#F7FAFC',
}

const FONT = "DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif"

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function text(x, y, value, { size = 16, weight = 400, fill = C.ink, anchor = 'start', opacity = 1 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${esc(value)}</text>`
}

function rect(x, y, w, h, { fill = C.white, stroke = C.line, r = 12, sw = 1.5, opacity = 1 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`
}

function pill(x, y, label, { fill = C.cyanSoft, color = C.navy, size = 13, padX = 12, h = 26 } = {}) {
  const w = Math.round(label.length * size * 0.58 + padX * 2)
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>` +
    text(x + w / 2, y + h / 2 + size * 0.36, label, { size, weight: 600, fill: color, anchor: 'middle' })
  )
}

const bar = (x, y, w, fill = C.cyan, h = 8, r = 4) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`

const arrow = (x1, y1, x2, y2, color = '#9FB3C8') =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${color}" stroke-width="2" marker-end="url(#arrowhead)" fill="none"/>`

const defs = `
<defs>
  <marker id="arrowhead" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
    <path d="M0 0 L9 4.5 L0 9 z" fill="#9FB3C8"/>
  </marker>
  <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0B1F33"/><stop offset="100%" stop-color="#063B8F"/>
  </linearGradient>
  <linearGradient id="soft" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#F7FAFC"/><stop offset="100%" stop-color="#E8EFF7"/>
  </linearGradient>
</defs>`

const pageBg = (w, h) => `<rect width="${w}" height="${h}" fill="url(#soft)"/>`

const caption = (w, h, label) =>
  text(w / 2, h - 22, label, { size: 14, weight: 600, fill: C.slate, anchor: 'middle', opacity: 0.85 })

/* ------------------------------------------------------------------ */
/* 1. CRM dashboard                                                    */
/* ------------------------------------------------------------------ */
function crmDashboard() {
  const w = 1344
  const h = 768
  const nav = ['Dashboard', 'Leads', 'Clients', 'Projects', 'Approvals', 'Invoices']
  const stages = [
    { name: 'New enquiry', cards: ['Northwind Retail', 'Harbour Clinic'], count: 2 },
    { name: 'Scoped', cards: ['Cedar Logistics', 'Atlas Manufacturing'], count: 2 },
    { name: 'Approved', cards: ['Riverbend School'], count: 1 },
    { name: 'Delivered', cards: ['Quarry Studio'], count: 1 },
  ]
  const cardH = 66
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  ${defs}${pageBg(w, h)}
  ${rect(48, 44, w - 96, h - 128, { fill: C.white, stroke: C.line, r: 20, sw: 2 })}
  <!-- window bar -->
  ${rect(48, 44, w - 96, 54, { fill: C.navy, stroke: C.navy, r: 20 })}
  ${rect(48, 78, w - 96, 20, { fill: C.navy, stroke: C.navy, r: 0 })}
  <circle cx="80" cy="71" r="6" fill="${C.red}"/><circle cx="100" cy="71" r="6" fill="${C.amber}"/><circle cx="120" cy="71" r="6" fill="${C.green}"/>
  ${text(150, 77, 'TECH360 CRM — Client pipeline', { size: 15, weight: 700, fill: C.white, opacity: 0.92 })}
  ${pill(w - 250, 58, 'Live data', { fill: 'rgba(255,255,255,0.16)', color: C.white, size: 12 })}

  <!-- sidebar -->
  <rect x="48" y="98" width="212" height="${h - 182}" fill="${C.slateSoft}"/>
  ${text(72, 136, 'WORKSPACE', { size: 11, weight: 700, fill: '#8AA0B4' })}
  ${nav
    .map((item, i) => {
      const y = 156 + i * 44
      const active = i === 1
      return (
        `${active ? `<rect x="60" y="${y - 20}" width="188" height="34" rx="8" fill="${C.white}" stroke="${C.line}"/>` : ''}` +
        `${bar(74, y - 9, 14, active ? C.cyan : '#B9C8D6', 14, 4)}` +
        text(98, y, item, { size: 14, weight: active ? 700 : 500, fill: active ? C.navy : C.slate })
      )
    })
    .join('')}
  ${rect(68, h - 200, 172, 62, { fill: C.cyanSoft, stroke: '#BFE6F8', r: 12 })}
  ${text(84, h - 172, 'Human approval', { size: 12, weight: 700, fill: C.navy })}
  ${text(84, h - 154, 'required for scope', { size: 12, fill: C.slate })}

  <!-- KPI row -->
  ${[
    { label: 'Open enquiries', value: '18', tone: C.navy },
    { label: 'Scoped this week', value: '6', tone: C.cyan },
    { label: 'Awaiting approval', value: '3', tone: C.amber },
    { label: 'Handed over', value: '11', tone: C.green },
  ]
    .map((k, i) => {
      const x = 292 + i * 250
      return (
        rect(x, 120, 228, 92, { fill: C.white, stroke: C.line, r: 14 }) +
        text(x + 20, 152, k.label, { size: 12, weight: 600, fill: C.slate }) +
        text(x + 20, 190, k.value, { size: 30, weight: 800, fill: k.tone }) +
        bar(x + 150, 178, 58, k.tone, 8)
      )
    })
    .join('')}

  <!-- pipeline board -->
  ${text(292, 244, 'Pipeline by stage', { size: 15, weight: 700, fill: C.ink })}
  ${stages
    .map((stage, i) => {
      const x = 292 + i * 250
      const top = 262
      const bodyH = 3 * (cardH + 12) + 16
      return (
        rect(x, top, 228, bodyH, { fill: C.slateSoft, stroke: C.line, r: 14 }) +
        text(x + 18, top + 28, stage.name, { size: 13, weight: 700, fill: C.navy }) +
        `<circle cx="${x + 200}" cy="${top + 23}" r="11" fill="${C.white}" stroke="${C.line}"/>` +
        text(x + 200, top + 27, String(stage.count), { size: 11, weight: 700, fill: C.slate, anchor: 'middle' }) +
        stage.cards
          .map((card, j) => {
            const y = top + 44 + j * (cardH + 12)
            return (
              rect(x + 14, y, 200, cardH, { fill: C.white, stroke: C.line, r: 10 }) +
              text(x + 28, y + 26, card, { size: 12.5, weight: 700, fill: C.ink }) +
              bar(x + 28, y + 38, 96 + j * 18, C.line, 7) +
              pill(x + 28, y + 48, j === 0 ? 'Owner set' : 'Scoped', {
                fill: i === 0 ? C.cyanSoft : i === 3 ? C.greenSoft : C.amberSoft,
                color: i === 0 ? C.navy : i === 3 ? '#146B2B' : '#8A5A08',
                size: 10,
                padX: 8,
                h: 18,
              })
            )
          })
          .join('')
      )
    })
    .join('')}
  ${text(48 + 16, h - 96, 'Interface illustration. Client names are fictional; no live data is shown.', {
    size: 12.5,
    fill: C.slate,
    opacity: 0.9,
  })}
  ${caption(w, h, 'Client pipeline console')}
</svg>`
}

/* ------------------------------------------------------------------ */
/* 2. Hero platform                                                    */
/* ------------------------------------------------------------------ */
function heroPlatform() {
  const w = 1344
  const h = 768
  const pillars = [
    { title: 'Template library', detail: 'Industry starting points', tone: C.cyan },
    { title: 'Module engine', detail: 'Versioned, swappable modules', tone: C.navy },
    { title: 'Company provisioning', detail: 'Isolated tenant setup', tone: C.cyan },
    { title: 'Version control', detail: 'Every change attributed', tone: C.navy },
    { title: 'Deployment & recovery', detail: 'Staging promotion, rollback', tone: C.green },
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  ${defs}${pageBg(w, h)}
  ${text(w / 2, 92, 'Company-in-a-Box platform', { size: 40, weight: 800, fill: C.ink, anchor: 'middle' })}
  ${text(w / 2, 128, 'Five pillars, one private system you control', { size: 17, fill: C.slate, anchor: 'middle' })}

  ${rect(120, 168, w - 240, 420, { fill: C.white, stroke: C.line, r: 22, sw: 2 })}
  ${text(160, 210, 'PLATFORM LAYERS', { size: 12, weight: 700, fill: '#8AA0B4' })}
  ${pill(w - 300, 190, 'Self-hosted · no country lock-in', { fill: C.greenSoft, color: '#146B2B', size: 12 })}

  ${pillars
    .map((p, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = 160 + col * 352
      const y = 236 + row * 168
      return (
        rect(x, y, 320, 140, { fill: C.slateSoft, stroke: C.line, r: 16 }) +
        `<rect x="${x}" y="${y}" width="6" height="140" rx="3" fill="${p.tone}"/>` +
        text(x + 28, y + 40, p.title, { size: 17, weight: 700, fill: C.ink }) +
        text(x + 28, y + 66, p.detail, { size: 13, fill: C.slate }) +
        [0, 1, 2]
          .map((k) => bar(x + 28, y + 84 + k * 16, 180 - k * 34, k === 0 ? p.tone : C.line, 7))
          .join('')
      )
    })
    .join('')}

  <!-- tenant strip -->
  ${rect(120, 610, w - 240, 74, { fill: C.ink, stroke: C.ink, r: 18 })}
  ${text(160, 654, 'Your company · your data · worldwide', { size: 17, weight: 700, fill: C.white })}
  ${['Isolated tenants', 'Audited changes', 'Documented handover']
    .map((label, i) => pill(w - 760 + i * 250, 634, label, { fill: 'rgba(255,255,255,0.12)', color: C.white, size: 12 }))
    .join('')}
  ${caption(w, h, 'Platform architecture illustration')}
</svg>`
}

/* ------------------------------------------------------------------ */
/* 3. Automation workflow                                              */
/* ------------------------------------------------------------------ */
function automationWorkflow() {
  const w = 1344
  const h = 768
  const steps = [
    { n: '01', title: 'Trigger', detail: 'New enquiry received', tone: C.cyan },
    { n: '02', title: 'Validate', detail: 'Check required fields', tone: C.navy },
    { n: '03', title: 'Assign', detail: 'Route to an owner', tone: C.cyan },
    { n: '04', title: 'Approve', detail: 'Human approval gate', tone: C.amber },
    { n: '05', title: 'Deliver', detail: 'Send and log the result', tone: C.green },
  ]
  const y = 300
  const bw = 216
  const gap = 42
  const startX = (w - (steps.length * bw + (steps.length - 1) * gap)) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  ${defs}${pageBg(w, h)}
  ${text(w / 2, 118, 'Automation workflow', { size: 40, weight: 800, fill: C.ink, anchor: 'middle' })}
  ${text(w / 2, 154, 'Every run is logged, retried safely, and paused for approval when the action matters', {
    size: 17,
    fill: C.slate,
    anchor: 'middle',
  })}
  ${rect(96, 210, w - 192, 400, { fill: C.white, stroke: C.line, r: 22, sw: 2 })}
  ${steps
    .map((s, i) => {
      const x = startX + i * (bw + gap)
      const connector =
        i < steps.length - 1 ? arrow(x + bw + 6, y + 60, x + bw + gap - 8, y + 60) : ''
      return (
        connector +
        rect(x, y, bw, 152, { fill: C.white, stroke: C.line, r: 16 }) +
        `<rect x="${x}" y="${y}" width="${bw}" height="8" rx="4" fill="${s.tone}"/>` +
        text(x + 22, y + 46, s.n, { size: 13, weight: 800, fill: s.tone }) +
        text(x + 22, y + 78, s.title, { size: 19, weight: 700, fill: C.ink }) +
        text(x + 22, y + 104, s.detail, { size: 13, fill: C.slate }) +
        bar(x + 22, y + 122, 120, C.line, 7)
      )
    })
    .join('')}

  <!-- reliability strip -->
  ${rect(120, 470, w - 240, 108, { fill: C.slateSoft, stroke: C.line, r: 16 })}
  ${[
    { label: 'Idempotent runs', tone: C.navy },
    { label: 'Retry with backoff', tone: C.cyan },
    { label: 'Approval gate', tone: C.amber },
    { label: 'Full execution log', tone: C.green },
  ]
    .map((item, i) => {
      const x = 160 + i * 268
      return (
        `<circle cx="${x + 12}" cy="524" r="7" fill="${item.tone}"/>` +
        text(x + 30, 530, item.label, { size: 14, weight: 600, fill: C.ink })
      )
    })
    .join('')}
  ${caption(w, h, 'Workflow illustration')}
</svg>`
}

/* ------------------------------------------------------------------ */
/* 4. Development lifecycle                                            */
/* ------------------------------------------------------------------ */
function devLifecycle() {
  const w = 1344
  const h = 768
  const phases = [
    { title: 'Discover', detail: 'Requirements and constraints' },
    { title: 'Scope', detail: 'Written Scope of Work' },
    { title: 'Design', detail: 'Reviewable preview' },
    { title: 'Build', detail: 'Staged, reviewable increments' },
    { title: 'Verify', detail: 'Acceptance checks' },
    { title: 'Handover', detail: 'Code and documentation' },
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  ${defs}${pageBg(w, h)}
  ${text(w / 2, 108, 'Development lifecycle', { size: 40, weight: 800, fill: C.ink, anchor: 'middle' })}
  ${text(w / 2, 144, 'Six stages, each ending in a written review gate', { size: 17, fill: C.slate, anchor: 'middle' })}
  ${phases
    .map((p, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = 132 + col * 372
      const y = 200 + row * 232
      const tone = i < 2 ? C.cyan : i < 4 ? C.navy : C.green
      return (
        rect(x, y, 340, 188, { fill: C.white, stroke: C.line, r: 18 }) +
        `<circle cx="${x + 44}" cy="${y + 46}" r="22" fill="${tone}" opacity="0.14"/>` +
        text(x + 44, y + 52, String(i + 1), { size: 18, weight: 800, fill: tone, anchor: 'middle' }) +
        text(x + 82, y + 46, p.title, { size: 21, weight: 700, fill: C.ink }) +
        text(x + 82, y + 70, p.detail, { size: 13.5, fill: C.slate }) +
        bar(x + 30, y + 104, 276, C.line, 7) +
        bar(x + 30, y + 122, 210, C.line, 7) +
        pill(x + 30, y + 142, i === 5 ? 'Gate: handover package' : 'Gate: written sign-off', {
          fill: C.slateSoft,
          color: C.navy,
          size: 11.5,
        })
      )
    })
    .join('')}
  ${caption(w, h, 'Delivery lifecycle illustration')}
</svg>`
}

/* ------------------------------------------------------------------ */
/* 5. Quality checklist                                                */
/* ------------------------------------------------------------------ */
function qualityChecklist() {
  const size = 1024
  const items = [
    'Requirements traced to tests',
    'Peer review on every change',
    'Accessibility checks pass',
    'Performance budgets met',
    'Secrets never in source',
    'Backup and rollback verified',
    'Handover documentation complete',
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  ${defs}${pageBg(size, size)}
  ${text(size / 2, 108, 'Quality checklist', { size: 44, weight: 800, fill: C.ink, anchor: 'middle' })}
  ${text(size / 2, 146, 'Checks that must pass before anything ships', { size: 18, fill: C.slate, anchor: 'middle' })}
  ${rect(112, 190, size - 224, 640, { fill: C.white, stroke: C.line, r: 24, sw: 2 })}
  ${items
    .map((item, i) => {
      const y = 246 + i * 82
      return (
        `<circle cx="168" cy="${y}" r="17" fill="${C.greenSoft}" stroke="${C.green}" stroke-width="2"/>` +
        `<path d="M160 ${y} l6 7 l11 -13" stroke="${C.green}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        text(206, y + 7, item, { size: 19, weight: 600, fill: C.ink }) +
        bar(206, y + 22, 300 + ((i * 53) % 180), C.line, 6)
      )
    })
    .join('')}
  ${text(size / 2, size - 48, 'Quality gate illustration', { size: 14, weight: 600, fill: C.slate, anchor: 'middle', opacity: 0.85 })}
</svg>`
}

/* ------------------------------------------------------------------ */
/* 6. Tech stack                                                       */
/* ------------------------------------------------------------------ */
function techStack() {
  const w = 1344
  const h = 768
  const layers = [
    { name: 'Experience', detail: 'React · Next.js · Tailwind', tone: C.cyan },
    { name: 'Application', detail: 'Node · typed API routes · RBAC', tone: C.navy },
    { name: 'Data', detail: 'MySQL · Prisma · object storage', tone: C.navy },
    { name: 'Automation', detail: 'n8n · queues · schedulers', tone: C.cyan },
    { name: 'Platform', detail: 'Cloud hosting · CI/CD · monitoring', tone: C.green },
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  ${defs}${pageBg(w, h)}
  ${text(w / 2, 108, 'Technology stack', { size: 40, weight: 800, fill: C.ink, anchor: 'middle' })}
  ${text(w / 2, 144, 'Five layers, chosen per project and documented in the Scope of Work', {
    size: 17,
    fill: C.slate,
    anchor: 'middle',
  })}
  ${rect(96, 186, w - 192, 480, { fill: C.white, stroke: C.line, r: 22, sw: 2 })}
  ${layers
    .map((l, i) => {
      const y = 222 + i * 86
      const indent = 40 + i * 12
      return (
        rect(136 + indent, y, w - 272 - i * 24, 68, { fill: C.slateSoft, stroke: C.line, r: 12 }) +
        `<rect x="${136 + indent}" y="${y}" width="7" height="68" rx="3.5" fill="${l.tone}"/>` +
        text(176 + indent, y + 30, l.name, { size: 18, weight: 700, fill: C.ink }) +
        text(176 + indent, y + 52, l.detail, { size: 13, fill: C.slate }) +
        [0, 1, 2]
          .map((k) => `<circle cx="${w - 260 + k * 26}" cy="${y + 34}" r="6" fill="${l.tone}" opacity="${0.9 - k * 0.25}"/>`)
          .join('')
      )
    })
    .join('')}
  ${caption(w, h, 'Technology stack illustration')}
</svg>`
}

/* ------------------------------------------------------------------ */
/* 7. Security architecture                                            */
/* ------------------------------------------------------------------ */
function securityArchitecture() {
  const size = 1024
  const cx = size / 2
  const cy = 470
  const layers = [
    { r: 300, fill: C.white, label: 'Identity and access control', tone: C.navy },
    { r: 228, fill: C.slateSoft, label: 'Audited application layer', tone: C.cyan },
    { r: 156, fill: C.white, label: 'Encrypted data at rest', tone: C.cyan },
    { r: 84, fill: C.ink, label: 'Client data', tone: C.ink },
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  ${defs}${pageBg(size, size)}
  ${text(cx, 92, 'Security architecture', { size: 42, weight: 800, fill: C.ink, anchor: 'middle' })}
  ${text(cx, 126, 'Layered controls around the systems that hold client data', {
    size: 16,
    fill: C.slate,
    anchor: 'middle',
  })}
  ${layers
    .map(
      (layer) =>
        `<circle cx="${cx}" cy="${cy}" r="${layer.r}" fill="${layer.fill}" stroke="${layer.tone}" stroke-width="${layer.r < 100 ? 0 : 2}"/>`,
    )
    .join('')}
  ${text(cx, cy - 4, 'Client', { size: 18, weight: 700, fill: C.white, anchor: 'middle' })}
  ${text(cx, cy + 20, 'data', { size: 18, weight: 700, fill: C.white, anchor: 'middle' })}

  <!-- legend -->
  ${rect(112, 806, size - 224, 138, { fill: C.white, stroke: C.line, r: 18 })}
  ${[
    { label: 'Identity and access control', tone: C.navy },
    { label: 'Audited application layer', tone: C.cyan },
    { label: 'Encrypted data at rest', tone: C.cyan },
  ]
    .map((row, i) => {
      const y = 836 + i * 34
      return (
        `<circle cx="146" cy="${y}" r="7" fill="${row.tone}"/>` +
        text(170, y + 5, row.label, { size: 15, weight: 600, fill: C.ink }) +
        text(size - 146, y + 5, ['outer layer', 'middle layer', 'inner layer'][i], {
          size: 12.5,
          fill: C.slate,
          anchor: 'end',
        })
      )
    })
    .join('')}
  ${text(cx, size - 44, 'Security model illustration — not a compliance certification', {
    size: 13.5,
    weight: 600,
    fill: C.slate,
    anchor: 'middle',
    opacity: 0.85,
  })}
</svg>`
}

const IMAGES = [
  { file: 'crm-dashboard.png', build: crmDashboard },
  { file: 'hero-platform.png', build: heroPlatform },
  { file: 'automation-workflow.png', build: automationWorkflow },
  { file: 'dev-lifecycle.png', build: devLifecycle },
  { file: 'quality-checklist.png', build: qualityChecklist },
  { file: 'tech-stack.png', build: techStack },
  { file: 'security-architecture.png', build: securityArchitecture },
]

const check = process.argv.includes('--check')
mkdirSync(OUT, { recursive: true })

const SCRIPT_REFERENCE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/u

let failed = false
for (const image of IMAGES) {
  const svg = image.build()
  if (SCRIPT_REFERENCE.test(svg)) {
    console.error(`✗ ${image.file}: label text contains a non-Latin script`)
    failed = true
  }

  const rendered = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
  const target = join(OUT, image.file)

  if (check) {
    const current = existsSync(target) ? readFileSync(target) : null
    if (!current || !current.equals(rendered)) {
      console.error(`✗ ${image.file} is out of date — run: node scripts/generate-site-illustrations.mjs`)
      failed = true
    } else {
      console.log(`✓ ${image.file}`)
    }
  } else {
    // writeFileSync through sharp avoids a shared buffer race between renders
    await sharp(rendered).toFile(target)
    const meta = await sharp(target).metadata()
    console.log(`✓ ${image.file}  ${meta.width}×${meta.height}`)
  }
}

if (failed) process.exit(1)
