import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

// Source-level regression checks supplement, but do not replace, HTTP/RBAC tests.
describe('factory control-plane boundary', () => {
  it('defaults control-plane routes to Super Admin and keeps scoped runtime explicit', () => {
    const helper = readFileSync('src/lib/factory/control/http.ts', 'utf8')
    assert.match(helper, /minRole = 'SUPER_ADMIN'/)
    const runtime = readFileSync('src/app/api/factory/runtime/[slug]/route.ts', 'utf8')
    assert.match(runtime, /requireActor\(req, 'STAFF'\)/)
    assert.match(runtime, /resolveRuntime\(g\.actor, slug, 'read'\)/)
    const jobs = readFileSync('src/app/api/factory/jobs/route.ts', 'utf8')
    assert.doesNotMatch(jobs, /requireActor\(req, 'STAFF'\)/)
  })
  it('guards all legacy app factory handlers as Super Admin', () => {
    for (const path of ['src/app/api/admin/factory/apps/route.ts', 'src/app/api/admin/factory/apps/[id]/route.ts', 'src/app/api/admin/factory/apps/[id]/export/route.ts']) {
      const source = readFileSync(path, 'utf8')
      assert.doesNotMatch(source, /minRole: 'ADMIN'/, path)
      assert.match(source, /minRole: 'SUPER_ADMIN'/, path)
    }
  })
})

describe('public confidentiality regression checks', () => {
  it('does not render the internal pipeline view on a public route', () => {
    const app = readFileSync('src/app/page.tsx', 'utf8')
    assert.doesNotMatch(app, /import AgentPipelineView/)
    assert.match(app, /case 'pipeline': return <ProcessView \/>/)
  })
  it('does not describe factory internals in platform copy or metadata', () => {
    for (const path of ['src/components/site/PlatformView.tsx', 'src/lib/public-route-catalog.ts', 'src/lib/agent-content.ts']) {
      const source = readFileSync(path, 'utf8')
      assert.doesNotMatch(source, /template library|module engine|tenant provisioning|deployment & recovery/i, path)
    }
    assert.match(readFileSync('src/components/site/PlatformView.tsx', 'utf8'), /illustrative concepts/i)
  })
})
