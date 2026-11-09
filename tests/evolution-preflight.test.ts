import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { createEvolutionReviewPacket } from '../src/lib/agents/evolution/preflight'

describe('agent evolution review preflight', () => {
  const validCommit = 'a'.repeat(40)
  const validPatch = 'diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-old\n+new\n'

  it('produces a deterministic non-executable REVIEW_ONLY packet with SHA-256 digest', () => {
    const packet = createEvolutionReviewPacket({
      baseCommit: validCommit,
      proposal: 'Tighten error handling in worker retry.',
      patch: validPatch,
    })
    assert.equal(packet.baseCommit, validCommit)
    assert.equal(packet.status, 'REVIEW_ONLY')
    assert.equal(packet.executable, false)
    assert.match(packet.patchSha256, /^[0-9a-f]{64}$/)
    assert.equal(packet.patchBytes, Buffer.byteLength(validPatch, 'utf8'))
    assert.ok(packet.requirements.length >= 4)
  })

  it('rejects unsupported fields, short commits, oversized patches, and malformed inputs', () => {
    assert.throws(() => createEvolutionReviewPacket(null))
    assert.throws(() => createEvolutionReviewPacket([]))
    assert.throws(() =>
      createEvolutionReviewPacket({
        baseCommit: validCommit,
        proposal: 'Valid proposal text',
        patch: validPatch,
        execute: true,
      }),
    )
    assert.throws(() =>
      createEvolutionReviewPacket({
        baseCommit: 'abc123',
        proposal: 'Valid proposal text',
        patch: validPatch,
      }),
    )
    assert.throws(() =>
      createEvolutionReviewPacket({
        baseCommit: validCommit,
        proposal: 'too short',
        patch: validPatch,
      }),
    )
    assert.throws(() =>
      createEvolutionReviewPacket({
        baseCommit: validCommit,
        proposal: 'Valid proposal text',
        patch: 'x'.repeat(48_001),
      }),
    )
  })

  it('guards the preflight route with SUPER_ADMIN governance role and bounded stream reading', () => {
    const route = readFileSync('src/app/api/admin/agents/evolution/preflight/route.ts', 'utf8')
    assert.match(route, /AI_WORKFORCE_GOVERNANCE_ROLE/)
    assert.match(route, /readBoundedBody/)
    assert.match(route, /private, no-store/)
  })

  it('keeps Software Factory app creation and lifecycle transitions atomic and protected against re-planning after approval', () => {
    const createRoute = readFileSync('src/app/api/admin/factory/apps/route.ts', 'utf8')
    assert.match(createRoute, /createWithUniqueCode/)
    assert.match(createRoute, /db\.\$transaction/)

    const patchRoute = readFileSync('src/app/api/admin/factory/apps/[id]/route.ts', 'utf8')
    assert.match(patchRoute, /db\.\$transaction/)
    assert.match(patchRoute, /app\.status === 'APPROVED' && \['plan', 'build', 'preview'\]\.includes\(action\)/)
    assert.match(patchRoute, /tx\.generatedApp\.updateMany\(\{\s*where:\s*\{\s*id:\s*app\.id,\s*status:\s*app\.status\s*\}/)
  })
})
