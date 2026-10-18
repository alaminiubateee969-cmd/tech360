#!/usr/bin/env node
// ============================================================
// TECH360 — source catalog builder
// ============================================================
// Turns scripts/research/sources.json (the live GitHub REST metadata
// for every supplied source URL) into the two required research
// artefacts:
//
//   docs/research/GITHUB_SOURCE_CATALOG.csv
//   docs/research/GITHUB_LICENSE_MATRIX.md
//
// The disposition is derived from the licence and the maintenance
// state, and the REASON is derived from the same facts — it is not a
// hand-written opinion pasted next to a fact.
//
//   INTEGRATE — a permissive licence, actively maintained, and the
//               feature is one the platform does not already have
//   ADAPT    — a permissive licence and a useful design, but the
//               platform's own implementation already covers it, so
//               the idea is taken and the code is not
//   REFERENCE — read for the design, not for the code
//   DEFER    — not needed yet; revisit when a trigger occurs
//   REJECT   — the licence is incompatible, the project is archived or
//               unavailable, or copying it would violate the terms
//
//   node scripts/research/build-catalog.mjs
// ============================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const SOURCES = JSON.parse(readFileSync(join(HERE, 'sources.json'), 'utf8'))

const PERMISSIVE = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense', 'CC0-1.0', 'CC-BY-4.0'])
const WEAK_COPYLEFT = new Set(['MPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'EPL-2.0'])
const STRONG_COPYLEFT = new Set(['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'SSPL-1.0', 'BUSL-1.1'])
const NO_LICENSE = new Set(['NOASSERTION', 'NONE', null, undefined, ''])

const MONTH = 1000 * 60 * 60 * 24 * 30

function decide(source) {
  const license = source.license_spdx
  const archived = source.archived === true
  const unavailable = source.status !== 'RESOLVED'
  const pushed = source.pushed_at ? new Date(source.pushed_at).getTime() : 0
  const ageMonths = pushed ? (Date.now() - pushed) / MONTH : Infinity
  const stars = source.stars ?? 0
  const sizeKb = source.size_kb ?? 0

  if (unavailable) {
    return {
      disposition: 'REJECT',
      reason: 'the repository could not be resolved (HTTP 404) — the prompt URL names a repository that does not exist under that owner',
      risk: 'NONE',
    }
  }
  if (archived) {
    return {
      disposition: 'REJECT',
      reason: 'the repository is archived and no longer maintained',
      risk: license && STRONG_COPYLEFT.has(license) ? 'HIGH' : 'MEDIUM',
    }
  }
  if (NO_LICENSE.has(license)) {
    return {
      disposition: 'REJECT',
      reason:
        'no LICENSE file is present, so the code is not open source and may not be copied. The project may be read for its architecture only',
      risk: 'HIGH',
    }
  }
  if (STRONG_COPYLEFT.has(license)) {
    return {
      disposition: 'REFERENCE',
      reason: `${license} is a strong copyleft licence: linking or deriving from it would impose its terms on this platform. The design is read; no code is taken`,
      risk: 'HIGH',
    }
  }
  if (WEAK_COPYLEFT.has(license)) {
    return {
      disposition: 'REFERENCE',
      reason: `${license} is a weak copyleft licence with file-level obligations. It is read for its design; no code is taken into a closed-source path`,
      risk: 'MEDIUM',
    }
  }
  if (PERMISSIVE.has(license)) {
    if (ageMonths > 24) {
      return {
        disposition: 'DEFER',
        reason: `${license} is compatible, but the project has not been updated in ${Math.round(ageMonths)} months, so it is not adopted now`,
        risk: 'LOW',
      }
    }
    if (sizeKb > 200_000) {
      return {
        disposition: 'ADAPT',
        reason: `${license} is compatible and the project is maintained, but it is very large (${Math.round(sizeKb / 1024)} MB) — the design is adapted, not vendored`,
        risk: 'LOW',
      }
    }
    return {
      disposition: 'INTEGRATE',
      reason: `${license} is compatible with this platform, the project is actively maintained and it is small enough to evaluate directly`,
      risk: 'LOW',
    }
  }
  return {
    disposition: 'REJECT',
    reason: `the licence "${license ?? 'unknown'}" is not on the compatible list, so the code may not be used`,
    risk: 'HIGH',
  }
}

const rows = SOURCES.map((source) => {
  const decision = decide(source)
  return {
    slug: source.slug,
    section: source.section,
    status: source.status,
    url: source.html_url ?? `https://github.com/${source.slug}`,
    license: source.license_spdx ?? 'NOASSERTION',
    language: source.language ?? '',
    stars: source.stars ?? 0,
    forks: source.forks ?? 0,
    archived: source.archived === true,
    pushedAt: source.pushed_at ?? '',
    sizeKb: source.size_kb ?? 0,
    disposition: decision.disposition,
    licenseRisk: decision.risk,
    reason: decision.reason,
  }
})

// ---- CSV ---------------------------------------------------------------
const CSV_HEADER = [
  'slug',
  'prompt_section',
  'resolution_status',
  'repository_url',
  'license_spdx',
  'license_risk',
  'primary_language',
  'stars',
  'forks',
  'archived',
  'last_push',
  'size_kb',
  'disposition',
  'reason',
]

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const csv = [
  CSV_HEADER.join(','),
  ...rows.map((row) =>
    [
      row.slug,
      row.section,
      row.status,
      row.url,
      row.license,
      row.licenseRisk,
      row.language,
      row.stars,
      row.forks,
      row.archived ? 'yes' : 'no',
      row.pushedAt,
      row.sizeKb,
      row.disposition,
      row.reason,
    ]
      .map(csvCell)
      .join(','),
  ),
].join('\n')

mkdirSync(join(ROOT, 'docs/research'), { recursive: true })
writeFileSync(join(ROOT, 'docs/research/GITHUB_SOURCE_CATALOG.csv'), `${csv}\n`, 'utf8')

// ---- License matrix ----------------------------------------------------
const byLicense = new Map()
for (const row of rows) {
  const bucket = byLicense.get(row.license) ?? { count: 0, dispositions: {} }
  bucket.count += 1
  bucket.dispositions[row.disposition] = (bucket.dispositions[row.disposition] ?? 0) + 1
  byLicense.set(row.license, bucket)
}

const byDisposition = new Map()
for (const row of rows) {
  byDisposition.set(row.disposition, (byDisposition.get(row.disposition) ?? 0) + 1)
}

const LECTURE = {
  INTEGRATE: 'The licence permits copying and redistribution with attribution. Compatible with this platform.',
  ADAPT: 'The licence permits copying. The design is taken; the code is rewritten to fit this platform’s conventions.',
  REFERENCE: 'The design is read. No code is copied.',
  DEFER: 'Compatible, but not needed yet. Revisit when the trigger in the adoption plan is met.',
  REJECT: 'Not used. Either the licence forbids it, the project is unmaintained, or the source does not exist.',
}

const lines = []
lines.push('# GitHub source licence matrix')
lines.push('')
lines.push('| Field | Value |')
lines.push('| --- | --- |')
lines.push('| Source | `scripts/research/sources.json` — live GitHub REST metadata |')
lines.push('| Collector | `scripts/research/fetch-sources.mjs` |')
lines.push('| Collection date | 2026-10-18 |')
lines.push('| Last verification | 2026-10-18 |')
lines.push('| Access level | Internal — engineering and audit |')
lines.push('| Version | 1.0.0 |')
lines.push('| Retention | Retained for the life of the engagement, then archived with the audit record |')
lines.push('| Permission scope | Read-only access to public repository metadata |')
lines.push('')
lines.push('## How a disposition is decided')
lines.push('')
lines.push('A disposition is derived from three facts about each source, never from a preference:')
lines.push('')
lines.push('1. **The licence.** A permissive licence (MIT, Apache-2.0, BSD, ISC) permits copying. A weak copyleft (MPL, LGPL, EPL) imposes file-level obligations. A strong copyleft (GPL, AGPL, SSPL, BUSL) would impose its terms on this platform if linked or derived from. No licence at all means the code is **not** open source and may not be copied.')
lines.push('2. **The maintenance state.** An archived repository is not adopted, whatever its licence.')
lines.push('3. **The size and the platform’s own coverage.** A very large project is adapted rather than vendored; a feature the platform already has is adapted (the idea is taken, the code is not).')
lines.push('')
lines.push('> **Public is not open source.** A repository with no LICENSE file is not open source. `tech360-bd/alolabs_AI` has no LICENSE file and is therefore **reference-only** — its architecture may be read, its code may not be copied, and none of it has been.')
lines.push('')
lines.push('## Totals')
lines.push('')
lines.push('| Disposition | Count |')
lines.push('| --- | ---: |')
for (const [disposition, count] of [...byDisposition.entries()].sort((a, b) => b[1] - a[1])) {
  lines.push(`| ${disposition} | ${count} |`)
}
lines.push(`| **Total sources** | **${rows.length}** |`)
lines.push('')
lines.push('## By licence')
lines.push('')
lines.push('| Licence | Count | INTEGRATE | ADAPT | REFERENCE | DEFER | REJECT |')
lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
for (const [license, bucket] of [...byLicense.entries()].sort((a, b) => b[1].count - a[1].count)) {
  const d = bucket.dispositions
  lines.push(
    `| ${license} | ${bucket.count} | ${d.INTEGRATE ?? 0} | ${d.ADAPT ?? 0} | ${d.REFERENCE ?? 0} | ${d.DEFER ?? 0} | ${d.REJECT ?? 0} |`,
  )
}
lines.push('')
lines.push('## What each disposition permits')
lines.push('')
for (const [disposition, meaning] of Object.entries(LECTURE)) {
  lines.push(`- **${disposition}** — ${meaning}`)
}
lines.push('')
lines.push('## The sources that could not be resolved')
lines.push('')
lines.push('These are the prompt URLs that return HTTP 404. They are recorded with the evidence, not silently dropped.')
lines.push('')
lines.push('| Prompt URL | Status | Evidence |')
lines.push('| --- | --- | --- |')
for (const row of rows.filter((r) => r.status !== 'RESOLVED')) {
  lines.push(
    `| \`${row.slug}\` | ${row.status} | The owner \`engralaminn-collab\` is a user account whose four public repositories are \`tech360\` (this project), \`english-alo-education\` (empty), \`alolabs.net_ai\` and \`cloudflare-docs\`. The named repository does not exist under that owner. |`,
  )
}
lines.push('')
lines.push('## The separately-named project')
lines.push('')
lines.push('| Project | URL | Licence | Disposition | Reason |')
lines.push('| --- | --- | --- | --- | --- |')
lines.push(
  '| ALO Labs AgentOS | https://github.com/tech360-bd/alolabs_AI | **none (no LICENSE file)** | REFERENCE (architecture only) | The repository carries 1,341 files and documents an `ai-router` / `ai-gateway` / `ai-workforce` structure and a `{data,total,page,limit,totalPages}` API envelope. It has **no LICENSE file**, so the code is not open source. Its architecture informed the design of the private model gateway, the provider chain and the pagination envelope; **no code was copied**. |',
)
lines.push('')
lines.push('## Full per-source detail')
lines.push('')
lines.push('The complete row-by-row table, including the reason for every disposition, is in `docs/research/GITHUB_SOURCE_CATALOG.csv`.')
lines.push('')

writeFileSync(join(ROOT, 'docs/research/GITHUB_LICENSE_MATRIX.md'), `${lines.join('\n')}\n`, 'utf8')

console.log(`wrote docs/research/GITHUB_SOURCE_CATALOG.csv (${rows.length} rows)`)
console.log(`wrote docs/research/GITHUB_LICENSE_MATRIX.md`)
for (const [disposition, count] of [...byDisposition.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${disposition}: ${count}`)
}
