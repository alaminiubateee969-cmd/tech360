#!/usr/bin/env node
// ============================================================
// TECH360 — GitHub source catalog collector
// Collects live, verifiable metadata for every submitted source
// repository via the authenticated GitHub REST API.
// Output: scripts/research/sources.json
// No source code is copied; only metadata + license facts are recorded.
// ============================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

// Some CI/sandbox networks sit behind a TLS-terminating proxy whose CA is in the
// system trust store but not in Node's bundled root set. Re-exec once with the
// system bundle so `fetch` can verify the chain.
if (!process.env.TECH360_EXTRA_CA) {
  const ca = '/etc/ssl/certs/ca-certificates.crt'
  if (existsSync(ca)) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      stdio: 'inherit',
      env: { ...process.env, NODE_EXTRA_CA_CERTS: ca, TECH360_EXTRA_CA: '1' },
    })
    process.exit(r.status ?? 1)
  }
}

function ghToken() {
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()
  } catch {
    return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
  }
}

const TOKEN = ghToken()
if (!TOKEN) {
  console.error('FATAL: no GitHub token available (gh auth token / GITHUB_TOKEN)')
  process.exit(1)
}

const INPUT = path.join(__dirname, 'source-urls.txt')

function parseInput() {
  const raw = readFileSync(INPUT, 'utf8')
  const out = []
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const [slug, section = 'UNCLASSIFIED'] = t.split('|')
    out.push({ slug: slug.trim(), section: section.trim() })
  }
  return out
}

async function api(pathname) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'tech360-source-audit',
    },
  })
  const remaining = res.headers.get('x-ratelimit-remaining')
  const limit = res.headers.get('x-ratelimit-limit')
  if (res.status === 404) return { __status: 404, __rate: { remaining, limit } }
  if (res.status === 403 && remaining === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000
    const waitMs = Math.max(1000, reset - Date.now() + 2000)
    console.error(`rate limit hit; sleeping ${Math.round(waitMs / 1000)}s`)
    await new Promise((r) => setTimeout(r, waitMs))
    return api(pathname)
  }
  if (!res.ok) return { __status: res.status, __error: (await res.text()).slice(0, 300) }
  const body = await res.json()
  body.__rate = { remaining, limit }
  return body
}

function isoOrEmpty(v) {
  return typeof v === 'string' && v ? v : ''
}

async function main() {
  const entries = parseInput()
  const results = []
  let i = 0
  const CONCURRENCY = 4

  async function worker() {
    while (i < entries.length) {
      const idx = i++
      const entry = entries[idx]
      const [owner, repo] = entry.slug.split('/')
      const data = await api(`/repos/${owner}/${repo}`)
      if (data.__status === 404) {
        console.error(`[404] ${entry.slug}`)
        results[idx] = {
          slug: entry.slug,
          section: entry.section,
          status: 'UNAVAILABLE',
          http_status: 404,
          detail: 'GitHub REST API returned 404 — repository does not exist, was renamed, was made private, or the owner/name is wrong.',
          html_url: `https://github.com/${entry.slug}`,
        }
        continue
      }
      if (data.__status) {
        console.error(`[${data.__status}] ${entry.slug}`)
        results[idx] = {
          slug: entry.slug,
          section: entry.section,
          status: 'ERROR',
          http_status: data.__status,
          detail: data.__error || 'API error',
          html_url: `https://github.com/${entry.slug}`,
        }
        continue
      }
      const license = data.license || null
      results[idx] = {
        slug: entry.slug,
        section: entry.section,
        status: 'RESOLVED',
        full_name: data.full_name,
        html_url: data.html_url,
        description: data.description || '',
        homepage: data.homepage || '',
        default_branch: data.default_branch,
        archived: !!data.archived,
        disabled: !!data.disabled,
        is_fork: !!data.fork,
        visibility: data.visibility,
        owner_type: data.owner?.type || '',
        owner_login: data.owner?.login || owner,
        license_spdx: license?.spdx_id || 'NOASSERTION',
        license_name: license?.name || 'NO LICENSE DETECTED',
        language: data.language || 'N/A',
        topics: Array.isArray(data.topics) ? data.topics : [],
        stars: data.stargazers_count ?? 0,
        forks: data.forks_count ?? 0,
        open_issues: data.open_issues_count ?? 0,
        watchers: data.subscribers_count ?? 0,
        size_kb: data.size ?? 0,
        created_at: isoOrEmpty(data.created_at),
        updated_at: isoOrEmpty(data.updated_at),
        pushed_at: isoOrEmpty(data.pushed_at),
        has_issues: !!data.has_issues,
        has_wiki: !!data.has_wiki,
        rate_remaining: data.__rate?.remaining,
      }
      console.error(`[ok] ${entry.slug} — ${results[idx].license_spdx} — pushed ${results[idx].pushed_at}`)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  results.sort((a, b) => a.slug.localeCompare(b.slug))
  const out = path.join(__dirname, 'sources.json')
  writeFileSync(out, JSON.stringify(results, null, 2))
  const ok = results.filter((r) => r.status === 'RESOLVED').length
  console.error(`\nWrote ${out}: ${ok} resolved / ${results.length} total`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
