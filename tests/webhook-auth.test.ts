/**
 * TECH360 — webhook authentication must FAIL CLOSED.
 *
 * Regression guard for a critical defect found in audit: the n8n and social
 * webhooks used `if (secret && header !== secret)`, so an UNSET secret — which
 * is exactly what .env.example shipped — let anonymous callers through.
 *
 * The n8n endpoint can reach VERIFY_PAYMENT, RECORD_PAYMENT, START_PROJECT,
 * CLIENT_SCOPE_DECISION and PREPARE_HANDOVER, so an unauthenticated caller
 * could have verified payments and prepared source-code handover.
 *
 * These are static source assertions: they run without a server, in CI, and
 * fail the build if the fail-open shape ever comes back.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { constantTimeEquals } from '../src/lib/constant-time'

const ROOT = join(import.meta.dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/** Source with comments removed — assertions must inspect code, not prose. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')

const SECRET_GUARDED = [
  ['src/app/api/webhooks/n8n/route.ts', 'N8N_WEBHOOK_SECRET'],
  ['src/app/api/webhooks/social/route.ts', 'SOCIAL_WEBHOOK_SECRET'],
  ['src/app/api/webhooks/whatsapp/route.ts', 'WHATSAPP_APP_SECRET'],
] as const

describe('webhooks fail closed when their secret is not configured', () => {
  for (const [file, envVar] of SECRET_GUARDED) {
    it(`${file} rejects when ${envVar} is unset`, () => {
      const src = read(file)
      assert.ok(src.includes(envVar), `${file} must read ${envVar}`)
      assert.match(
        src,
        /if \(!(?:secret|appSecret)\)\s*\{/,
        `${file} must explicitly reject an unset secret`,
      )
      assert.ok(src.includes('503'), `${file} must answer 503 when unconfigured`)
    })

    it(`${file} never uses the fail-open 'secret && ...' shape`, () => {
      const src = code(file)
      assert.doesNotMatch(
        src,
        /if\s*\(\s*secret\s*&&/,
        `${file} reintroduced the fail-open guard`,
      )
    })

    it(`${file} compares the secret in constant time`, () => {
      assert.ok(
        read(file).includes('constantTimeEquals'),
        `${file} must not compare secrets with ===`,
      )
    })
  }
})

describe('ops endpoints are secret-protected in constant time', () => {
  for (const f of ['act', 'cycle', 'heartbeat', 'scan']) {
    it(`ops/${f} uses constantTimeEquals`, () => {
      const src = code(`src/app/api/ops/${f}/route.ts`)
      assert.ok(src.includes('OPS_SECRET'))
      assert.ok(src.includes('constantTimeEquals'), `ops/${f} must not compare with ===`)
      assert.doesNotMatch(src, /=== *secret/, `ops/${f} still has a plain comparison`)
    })
  }
})

describe('the WhatsApp webhook verifies the Meta signature', () => {
  const src = read('src/app/api/webhooks/whatsapp/route.ts')
  it('reads the raw body (re-serialising would break the HMAC)', () => {
    assert.ok(src.includes('req.text()'))
    assert.ok(src.includes('JSON.parse(rawBody)'))
  })
  it('checks x-hub-signature-256 as sha256 HMAC', () => {
    assert.ok(src.includes('x-hub-signature-256'))
    assert.ok(src.includes("createHmac('sha256'"))
    assert.ok(src.includes("'sha256=' +"))
  })
})

describe('constantTimeEquals', () => {
  it('matches equal strings', () => {
    assert.equal(constantTimeEquals('correct-horse', 'correct-horse'), true)
  })
  it('rejects different strings of equal length', () => {
    assert.equal(constantTimeEquals('aaaaaa', 'aaaaab'), false)
  })
  it('rejects different lengths without throwing', () => {
    assert.equal(constantTimeEquals('short', 'muchlongervalue'), false)
  })
  it('fails closed on empty, null and undefined', () => {
    for (const bad of ['', null, undefined]) {
      assert.equal(constantTimeEquals(bad, 'secret'), false)
      assert.equal(constantTimeEquals('secret', bad), false)
    }
    assert.equal(constantTimeEquals(null, null), false)
  })
  it('is not fooled by unicode of the same byte length', () => {
    assert.equal(constantTimeEquals('é', 'e'), false)
  })
})
