import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  AI_ADMIN_APPROVAL, AI_ALWAYS_SAVE, AI_AUTO_SEND, CLIENT_ID_FORMAT, CRM_PROFILE_FIELDS,
  FINAL_RULES, PIPELINE_BRAND, PIPELINE_CORE_RULE, PIPELINE_DOMAIN, PIPELINE_EMAIL,
  SPEC_CHANNELS, SPEC_GROUP_TITLES, SPEC_STAGES, SPEC_STAGE_GROUPS,
} from '../src/lib/pipeline/spec-copy'
import {
  ADMIN_APPROVAL_STAGES, AUTO_SEND_STAGES, effectiveGate, findPhoneNumbers,
  gatePartitionIsComplete,
} from '../src/lib/pipeline/rules'
import { getStaticPublicRoutePaths, resolvePublicRoute } from '../src/lib/public-route-catalog'
import { GET } from '../src/app/api/pipeline/public/route'

const ROOT = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

describe('master specification copy is complete and safe to publish', () => {
  it('keeps the exact brand identity and the two-part core rule', () => {
    assert.equal(PIPELINE_BRAND, 'Tech360')
    assert.equal(PIPELINE_DOMAIN, 'https://bdtech360.com')
    assert.equal(PIPELINE_EMAIL, 'info@bdtech360.com')
    assert.equal(PIPELINE_CORE_RULE, 'HTML Preview Before Payment. Source Code After Full Payment.')
    assert.equal(CLIENT_ID_FORMAT, 'TECH-2026-000001')
  })

  it('has eleven stages and both branches of stages 5 and 7', () => {
    assert.equal(SPEC_GROUP_TITLES.length, 11)
    assert.equal(SPEC_STAGE_GROUPS.length, 11)
    for (let n = 1; n <= 11; n += 1) {
      const group = SPEC_STAGE_GROUPS[n - 1]
      assert.equal(group.number, n)
      assert.ok(group.title.length > 8, `stage ${n} needs a title`)
      assert.ok(group.entries.length >= 1, `stage ${n} needs copy`)
      assert.ok(group.entries.every((e) => e.stageNumber === n))
    }
    assert.equal(SPEC_STAGE_GROUPS[4].entries.length, 2)
    assert.deepEqual(SPEC_STAGE_GROUPS[4].entries.map((e) => e.branch), ['A', 'B'])
    assert.equal(SPEC_STAGE_GROUPS[6].entries.length, 2)
    assert.deepEqual(SPEC_STAGE_GROUPS[6].entries.map((e) => e.branch), ['A', 'B'])
    assert.equal(SPEC_STAGES.length, 13)
  })

  it('gives every variant its WhatsApp body, email subject/body, AI action and CRM saves', () => {
    const ids = new Set<string>()
    for (const stage of SPEC_STAGES) {
      assert.ok(!ids.has(stage.id), `duplicate stage id ${stage.id}`)
      ids.add(stage.id)
      assert.ok(stage.title.length > 8)
      assert.ok(stage.aiAction.length > 0, `${stage.id} needs AI actions`)
      assert.ok(stage.whatsapp.length > 40, `${stage.id} needs a WhatsApp body`)
      assert.ok(stage.emailSubject.length > 8, `${stage.id} needs an email subject`)
      assert.ok(stage.emailBody.length > 40, `${stage.id} needs an email body`)
      assert.ok(stage.crmSave.length > 0, `${stage.id} needs CRM saves`)
      assert.ok(['AUTO_SEND', 'ADMIN_APPROVAL_REQUIRED'].includes(stage.gate))
    }
  })

  it('preserves the exact stage-1 wording, including the Client ID and source questions', () => {
    const first = SPEC_STAGES[0]
    assert.equal(first.emailSubject, 'Tech360 Inquiry Received - Client ID [CLIENT_ID]')
    assert.match(first.whatsapp, /Hi, thank you for contacting Tech360\./)
    assert.match(first.whatsapp, /\[CLIENT_ID\]/)
    assert.match(first.whatsapp, /1\. Your business type/)
    assert.match(first.emailBody, /Website: https:\/\/bdtech360\.com/)
    assert.ok(first.crmSave.includes('status = New Lead'))
    assert.ok(first.crmSave.includes('communication_log = saved'))
    assert.ok(first.crmSave.includes('next_action = Wait for business type'))
    assert.equal(first.gate, 'AUTO_SEND')
  })

  it('preserves the exact stage-6 preview and stage-9 delivery wording', () => {
    const preview = SPEC_STAGES.find((s) => s.id === 'HTML_PREVIEW_SENT')!
    assert.match(preview.whatsapp, /Your HTML\/demo preview is ready\./)
    assert.match(preview.whatsapp, /1\. Approved\n2\. Need revision\n3\. Need meeting/)
    assert.ok(preview.crmSave.includes('preview_sent_date = current_datetime'))
    assert.equal(preview.gate, 'AUTO_SEND')
    const delivery = SPEC_STAGES.find((s) => s.id === 'FINAL_DELIVERY_READY')!
    assert.match(delivery.whatsapp, /✅ Final website\/system files/)
    assert.ok(delivery.crmSave.includes('admin_approval_required_for_file_release = yes'))
  })

  it('preserves the long stage-10 confirmation phrase and stage-11 closure fields', () => {
    const delivered = SPEC_STAGES.find((s) => s.id === 'FINAL_DELIVERY_COMPLETED')!
    assert.match(delivered.whatsapp, /I confirm that Tech360 has delivered\/deployed the approved project as per the approved Scope of Work\./)
    assert.match(delivered.whatsapp, /Tech360 will no longer have active access to my server\/source-code environment\./)
    assert.ok(delivered.crmSave.includes('password_change_confirmation_pending = yes'))
    const closed = SPEC_STAGES.find((s) => s.id === 'PROJECT_CLOSED')!
    assert.ok(closed.crmSave.includes('status = Project Closed'))
    assert.ok(closed.crmSave.includes('review_requested = yes'))
    assert.ok(closed.crmSave.includes('referral_requested = yes'))
    assert.ok(closed.crmSave.includes('project_close_date = current_datetime'))
  })

  it('does not put a phone number in any published client-facing copy', () => {
    for (const stage of SPEC_STAGES) {
      for (const text of [stage.whatsapp, stage.emailSubject, stage.emailBody, stage.title, ...stage.aiAction]) {
        assert.deepEqual(findPhoneNumbers(text), [], `phone number found in ${stage.id}`)
      }
    }
  })

  it('lists all ten channels, fourteen CRM fields and the exact gate allowlists', () => {
    assert.equal(SPEC_CHANNELS.length, 10)
    assert.deepEqual(
      SPEC_CHANNELS.map((c) => c.key).sort(),
      ['ADMIN', 'EMAIL', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'MESSENGER', 'SMS', 'WEB', 'WHATSAPP', 'X'].sort()
    )
    assert.equal(CRM_PROFILE_FIELDS.length, 14)
    for (const field of ['Client ID', 'Lead source', 'Payment history', 'Delivery history', 'Review history']) {
      assert.ok(CRM_PROFILE_FIELDS.includes(field))
    }
    assert.equal(AI_AUTO_SEND.length, 9)
    assert.ok(AI_AUTO_SEND.includes('HTML preview notification'))
    assert.equal(AI_ADMIN_APPROVAL.length, 7)
    assert.ok(AI_ADMIN_APPROVAL.includes('Final delivery file links'))
    assert.ok(AI_ADMIN_APPROVAL.includes('Payment instruction with amount'))
    assert.equal(AI_ALWAYS_SAVE.length, 11)
    assert.equal(FINAL_RULES.length, 6)
    assert.ok(FINAL_RULES.includes('No sensitive files in public AI content.'))
  })

  it('keeps the enforced gate partition complete and fail-closed', () => {
    assert.ok(gatePartitionIsComplete())
    assert.equal(effectiveGate('NOT_A_REAL_STAGE', 'hello'), 'ADMIN_APPROVAL_REQUIRED')
    assert.equal(effectiveGate('FIRST_MESSAGE', 'Hello, thanks for your message.'), 'AUTO_SEND')
    assert.equal(effectiveGate('FIRST_MESSAGE', 'Invoice INV-2026-0001 is ready.'), 'ADMIN_APPROVAL_REQUIRED')
    assert.equal(effectiveGate('FIRST_MESSAGE', 'Our legal position is that we owe nothing.'), 'ADMIN_APPROVAL_REQUIRED')
    assert.equal(effectiveGate('FIRST_MESSAGE', 'We processed your refund.'), 'ADMIN_APPROVAL_REQUIRED')
    assert.equal(effectiveGate('HTML_PREVIEW_SENT', 'Refund requests are reviewed under applicable law.'), 'AUTO_SEND')
    for (const stage of ADMIN_APPROVAL_STAGES) assert.ok(!AUTO_SEND_STAGES.includes(stage))
  })

  it('only marks final scope and preview approval as admin-controlled stages in the spec', () => {
    const gated = SPEC_STAGES.filter((s) => s.gate === 'ADMIN_APPROVAL_REQUIRED').map((s) => s.id)
    assert.deepEqual(gated.sort(), ['FINAL_SCOPE_APPROVED', 'HTML_PREVIEW_APPROVED'])
    assert.equal(SPEC_STAGES.find((s) => s.id === 'FINAL_DELIVERY_READY')!.gate, 'AUTO_SEND')
    assert.match(SPEC_STAGES.find((s) => s.id === 'FINAL_DELIVERY_READY')!.operatorNote!, /admin-approved action/)
  })
})

describe('the pipeline is coordinated into the public website', () => {
  it('resolves a clean /pipeline route and publishes it in the sitemap', () => {
    const route = resolvePublicRoute(['pipeline'])
    assert.ok(route)
    assert.equal(route.path, '/pipeline')
    assert.match(route.title, /AI Agent Communication Pipeline/)
    assert.ok(getStaticPublicRoutePaths().includes('/pipeline'))
    assert.match(read('src/app/sitemap.ts'), /\$\{SITE_URL\}\/pipeline/)
  })

  it('is routed in the hash SPA, linked from the header, footer and site data', () => {
    const page = read('src/app/page.tsx')
    assert.match(page, /case 'pipeline': return <AgentPipelineView \/>/)
    assert.match(page, /import AgentPipelineView from '@\/components\/site\/AgentPipelineView'/)
    assert.match(page, /'pipeline'/)
    const header = read('src/components/site/SiteHeader.tsx')
    assert.match(header, /href="#\/pipeline"/)
    assert.match(header, /activeSection === "pipeline"/)
    const footer = read('src/components/site/SiteFooter.tsx')
    assert.match(footer, /AI Agent Pipeline/)
    assert.match(footer, /\/api\/pipeline\/public/)
    assert.match(read('src/data/site.ts'), /AI Agent Pipeline/)
    assert.match(read('src/components/site/HomeView.tsx'), /Explore the pipeline/)
    assert.match(read('src/components/site/ProcessView.tsx'), /Open the pipeline/)
  })

  it('renders a real, consent-gated intake form and an interactive stage explorer', () => {
    const view = read('src/components/site/AgentPipelineView.tsx')
    assert.match(view, /fetch\("\/api\/contact"/)
    assert.match(view, /requestId/)
    assert.match(view, /consent: true/)
    assert.match(view, /details: form\.details\.trim\(\)/)
    assert.match(view, /businessName: form\.businessName\.trim\(\)/)
    assert.ok(!/message: form\.details/.test(view), "must use the contact API field name `details`")
    assert.match(view, /type="checkbox" required/)
    assert.match(view, /navigator\.clipboard\.writeText/)
    assert.match(view, /SPEC_STAGE_GROUPS/)
    assert.match(view, /GateBadge/)
    assert.match(view, /id="pipeline-stages"/)
    assert.match(view, /id="pipeline-start"/)
    assert.match(view, /HTML Preview Before Payment/)
  })

  it('serves a read-only public contract API with no client records or secrets', async () => {
    const res = await GET()
    assert.equal(res.status, 200)
    assert.match(res.headers.get('cache-control') ?? '', /public/)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body.brand, 'Tech360')
    assert.equal(body.coreRule, PIPELINE_CORE_RULE)
    assert.equal((body.meta as Record<string, unknown>).stageCount, 11)
    assert.equal((body.meta as Record<string, unknown>).messageVariantCount, 13)
    assert.equal(body.gatePartitionIsComplete, true)
    assert.equal((body.stages as unknown[]).length, 13)
    assert.equal((body.channels as unknown[]).length, 10)
    assert.equal((body.crmProfileFields as unknown[]).length, 14)
    assert.equal((body.autoSendMessages as unknown[]).length, 9)
    assert.equal((body.adminApprovalMessages as unknown[]).length, 7)
    const serialized = JSON.stringify(body)
    // The words "password" and "approval" legitimately appear in the approved
    // client copy (stage 10 asks the client to change passwords). What must
    // never appear is a real secret value, a credential or a client record.
    for (const secret of [
      process.env.DATABASE_URL, process.env.SOCIAL_WEBHOOK_SECRET,
      process.env.WHATSAPP_ACCESS_TOKEN, process.env.HOSTINGER_MAIL_PASSWORD,
      process.env.NEXTAUTH_SECRET, process.env.SESSION_SECRET,
    ]) {
      if (secret && secret.length > 7) assert.ok(!serialized.includes(secret), 'public API leaked an environment secret')
    }
    for (const forbidden of ['-----BEGIN', 'sk_live_', 'Bearer ', 'SELECT * FROM', 'clientRecord', 'realClientId', 'db.client']) {
      assert.ok(!serialized.includes(forbidden), `public API leaked ${forbidden}`)
    }
    assert.ok(!('clients' in body))
    assert.ok(!('messages' in body))
    assert.ok(!('approvals' in body))
    assert.deepEqual(findPhoneNumbers(serialized), [])
  })

  it('registers the new completion record in the private control-center document list', () => {
    const route = read('src/app/api/factory/docs/route.ts')
    assert.match(route, /docs\/TECH360-FULL-PROJECT-COMPLETION\.md/)
    assert.match(route, /docs\/implementation\/COMMUNICATION_PIPELINE\.md/)
    assert.ok(fs.existsSync(path.join(ROOT, 'docs/TECH360-FULL-PROJECT-COMPLETION.md')))
  })

  it('keeps the admin console role hints that the monitoring policy expects', () => {
    const app = read('src/components/admin/AdminApp.tsx')
    assert.match(app, /agents: 'ADMIN'/)
    assert.match(app, /command: 'ADMIN'/)
    assert.match(app, /NAV_ROLE_HINTS\[item\.id\]/)
  })
})
