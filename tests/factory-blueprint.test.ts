/**
 * TECH360 — AI Software Factory blueprint engine tests.
 *
 * These run without a database or a model call: the factory's contract is that
 * the SAME brief always produces the SAME plan and file tree, and that nothing
 * credential-shaped ever lands in a generated file.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  FACTORY_MODULES,
  FACTORY_VERTICALS,
  assertNoSecrets,
  buildFiles,
  buildPlan,
  normalizeBrief,
  slugify,
  summarizeFiles,
} from '../src/lib/factory/blueprint'

const baseBrief = {
  appName: 'Northwind Client Hub',
  clientName: 'Northwind Ltd',
  vertical: 'crm',
  modules: ['leads', 'pipeline', 'clients', 'invoices'],
  language: 'EN',
  currency: 'gbp',
  primaryColor: '#063b8f',
  primaryContact: 'ops@northwind.example',
  notes: 'They asked for everything.',
}

describe('factory: brief normalisation fails safe', () => {
  it('accepts a valid brief', () => {
    const b = normalizeBrief(baseBrief)
    assert.equal(b.appName, 'Northwind Client Hub')
    assert.equal(b.vertical, 'crm')
    assert.equal(b.currency, 'GBP')
    assert.equal(b.primaryColor, '#063B8F')
    assert.deepEqual(b.modules, ['leads', 'pipeline', 'clients', 'invoices'])
  })

  it('falls back to a supported vertical instead of guessing', () => {
    const b = normalizeBrief({ ...baseBrief, vertical: 'hospital-management' })
    assert.ok((FACTORY_VERTICALS as readonly string[]).includes(b.vertical))
    assert.equal(b.vertical, 'crm')
  })

  it('drops unknown module names and clamps text', () => {
    const b = normalizeBrief({ ...baseBrief, modules: ['leads', 'nonsense', 'analytics'], appName: 'x'.repeat(500) })
    assert.deepEqual(b.modules, ['leads', 'analytics'])
    assert.equal(b.appName.length, 80)
  })

  it('rejects an invalid colour and uses the brand default', () => {
    assert.equal(normalizeBrief({ ...baseBrief, primaryColor: 'red' }).primaryColor, '#063B8F')
  })

  it('applies the vertical default modules when none are supplied', () => {
    const b = normalizeBrief({ ...baseBrief, modules: [] })
    assert.ok(b.modules.length > 0)
    for (const m of b.modules) assert.ok((FACTORY_MODULES as readonly string[]).includes(m))
  })
})

describe('factory: blueprint completeness', () => {
  const brief = normalizeBrief(baseBrief)
  const plan = buildPlan(brief)

  it('always includes the public pages and an intake endpoint', () => {
    assert.ok(plan.pages.some((p) => p.path === '/'))
    assert.ok(plan.pages.some((p) => p.path === '/contact'))
    assert.ok(plan.endpoints.some((e) => e.method === 'POST' && e.path === '/api/leads'))
    assert.ok(plan.endpoints.some((e) => e.path === '/api/health'))
  })

  it('always models users and an audit trail', () => {
    const names = plan.models.map((m) => m.name)
    assert.ok(names.includes('User'))
    assert.ok(names.includes('AuditLog'))
    assert.ok(names.includes('Lead'))
  })

  it('states what it cannot build instead of dropping it', () => {
    assert.ok(plan.notBuilt.length >= 1)
    assert.ok(plan.notBuilt.some((n) => /NOT_CONFIGURED/.test(n)))
  })

  it('carries acceptance criteria that are testable', () => {
    assert.ok(plan.acceptanceCriteria.length >= 4)
    assert.ok(plan.acceptanceCriteria.some((c) => /database row/i.test(c)))
    assert.ok(plan.acceptanceCriteria.some((c) => /provider/i.test(c)))
  })

  it('reflects the requested modules in pages and models', () => {
    assert.ok(plan.pages.some((p) => p.path === '/admin/leads'))
    assert.ok(plan.models.some((m) => m.name === 'Invoice'))
    assert.ok(plan.agents.length > 0)
  })

  it('is deterministic — the same brief yields the same plan', () => {
    assert.deepEqual(buildPlan(normalizeBrief(baseBrief)), plan)
  })
})

describe('factory: generated file tree', () => {
  const brief = normalizeBrief(baseBrief)
  const plan = buildPlan(brief)
  const files = buildFiles(brief, plan)
  const paths = files.map((f) => f.path)

  it('ships an explainable project, not just code', () => {
    for (const required of ['README.md', 'docs/SCOPE.md', 'docs/HANDOVER.md', 'package.json', 'prisma/schema.prisma', '.env.example', 'src/lib/db.ts', 'src/app/api/leads/route.ts', 'src/app/api/health/route.ts']) {
      assert.ok(paths.includes(required), `missing ${required}`)
    }
  })

  it('writes environment NAMES only — never a value', () => {
    const env = files.find((f) => f.path === '.env.example')
    assert.ok(env)
    for (const line of env.content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      assert.match(trimmed, /^[A-Z0-9_]+=$/, `env line must be an empty NAME=, got: ${trimmed}`)
    }
  })

  it('copies the brief language and currency into the scope', () => {
    const scope = files.find((f) => f.path === 'docs/SCOPE.md')
    assert.ok(scope?.content.includes('GBP'))
    assert.ok(scope?.content.includes('English'))
  })

  it('never contains secret-shaped material', () => {
    assert.deepEqual(assertNoSecrets(files), { ok: true })
  })

  it('reports a consistent size summary', () => {
    const { fileCount, totalBytes } = summarizeFiles(files)
    assert.equal(fileCount, files.length)
    assert.ok(totalBytes > 2000)
  })

  it('is deterministic — identical content on a second run', () => {
    const again = buildFiles(brief, buildPlan(normalizeBrief(baseBrief)))
    assert.deepEqual(again, files)
  })
})

describe('factory: secret guard actually blocks', () => {
  it('detects a live Stripe key in a generated file', () => {
    const bad = [{ path: 'src/leak.ts', language: 'typescript', content: `const k = 'sk_live_${'a'.repeat(24)}'` }]
    const result = assertNoSecrets(bad)
    assert.equal(result.ok, false)
    assert.equal(result.ok === false ? result.path : '', 'src/leak.ts')
  })

  it('detects a private key block', () => {
    const bad = [{ path: 'key.pem', language: 'text', content: '-----BEGIN RSA PRIVATE KEY-----\nMIIE' }]
    assert.equal(assertNoSecrets(bad).ok, false)
  })
})

describe('factory: slugify', () => {
  it('produces a safe directory name', () => {
    assert.equal(slugify('Northwind Client Hub!'), 'northwind-client-hub')
    assert.equal(slugify('  ...  '), 'client-app')
    assert.equal(slugify('বাংলা নাম'), 'client-app')
  })
})
