/**
 * TECH360 — omnichannel template engine (WebChat, SMS, social).
 *
 * Verifies that every pipeline stage has channel-aware copy for SMS,
 * WebChat and the social channels, that placeholders are validated
 * before sending, and that public content never exposes private
 * Software Factory internals or non-USA positioning.
 *
 * Pure module tests — no database required.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  PIPELINE_CHANNELS,
  PIPELINE_COPY,
  PIPELINE_MESSAGE_STAGES,
  REQUIRED_VARIABLES_BY_STAGE,
  pipelineMessageForChannel,
  validatePipelineVariables,
  type PipelineChannelKind,
  type PipelineMessageStage,
  type PipelineVariables,
} from '../src/lib/pipeline/templates'

const V: PipelineVariables = {
  clientId: 'TECH-2026-000001',
  clientName: 'Sarah Johnson',
  businessName: 'Acme Retail',
  businessType: 'Retail',
  recommendedPlan: 'Custom CRM with client portal',
  meetingLink: 'https://bdtech360.com/meeting',
  projectName: 'Acme Retail Platform',
  finalScope: 'Website, CRM, and client portal with 3 milestones',
  htmlPreviewUrl: 'https://preview.bdtech360.com/abc123',
}

describe('omnichannel template coverage', () => {
  it('covers all 13 stages on every channel', () => {
    assert.equal(PIPELINE_MESSAGE_STAGES.length, 13)
    assert.equal(PIPELINE_CHANNELS.length, 9)
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      const copy = PIPELINE_COPY[stage]
      assert.ok(copy.whatsapp, `${stage} whatsapp`)
      assert.ok(copy.email, `${stage} email`)
      assert.ok(copy.sms, `${stage} sms`)
      assert.ok(copy.web, `${stage} web`)
      assert.ok(copy.social, `${stage} social`)
    }
  })

  it('produces a message for every stage × channel combination', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      for (const channel of PIPELINE_CHANNELS) {
        const msg = pipelineMessageForChannel(stage, channel, V)
        assert.equal(msg.stage, stage)
        assert.equal(msg.channel, channel)
        assert.ok(msg.body.length > 20, `${stage}/${channel} body too short`)
        assert.ok(msg.body.includes(V.clientId), `${stage}/${channel} must carry the Client ID`)
      }
    }
  })

  it('SMS copy is shorter than WhatsApp copy for the same stage', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      const wa = pipelineMessageForChannel(stage, 'WHATSAPP', V)
      const sms = pipelineMessageForChannel(stage, 'SMS', V)
      assert.ok(
        sms.body.length <= wa.body.length,
        `${stage}: SMS (${sms.body.length}) should not exceed WhatsApp (${wa.body.length})`,
      )
    }
  })

  it('WebChat copy is conversational and distinct from WhatsApp copy', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      const wa = pipelineMessageForChannel(stage, 'WHATSAPP', V)
      const web = pipelineMessageForChannel(stage, 'WEB', V)
      assert.notEqual(web.body, wa.body, `${stage}: WEB copy must differ from WhatsApp copy`)
    }
  })

  it('social copy is short and carries the channel', () => {
    const socialChannels: PipelineChannelKind[] = ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X', 'MESSENGER']
    for (const channel of socialChannels) {
      const msg = pipelineMessageForChannel('FIRST_MESSAGE', channel, V)
      assert.equal(msg.channel, channel)
      assert.ok(msg.body.length < 400, `${channel} social copy should be short`)
    }
  })

  it('email copy carries a subject and HTML body', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      const msg = pipelineMessageForChannel(stage, 'EMAIL', V)
      assert.ok(msg.subject, `${stage} email subject missing`)
      assert.ok(msg.html, `${stage} email html missing`)
      assert.ok(msg.subject!.includes('TECH360') || msg.subject!.includes('Tech360') || msg.subject!.includes(V.clientId), `${stage} subject should carry branding or Client ID`)
    }
  })

  it('preview stage carries the HTML preview URL on every channel', () => {
    for (const channel of PIPELINE_CHANNELS) {
      const msg = pipelineMessageForChannel('HTML_PREVIEW_SENT', channel, V)
      assert.ok(msg.body.includes(V.htmlPreviewUrl!), `${channel} must include the preview URL`)
    }
  })

  it('meeting stage carries the meeting link on every channel', () => {
    for (const channel of PIPELINE_CHANNELS) {
      const msg = pipelineMessageForChannel('MEETING_REQUESTED', channel, V)
      assert.ok(msg.body.includes(V.meetingLink!), `${channel} must include the meeting link`)
    }
  })
})

describe('placeholder validation', () => {
  it('passes when all required variables are present', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      const result = validatePipelineVariables(stage, V)
      assert.equal(result.ok, true, `${stage} should validate with full variables`)
      assert.deepEqual(result.missing, [])
    }
  })

  it('fails when the Client ID is missing', () => {
    const result = validatePipelineVariables('FIRST_MESSAGE', { ...V, clientId: '' })
    assert.equal(result.ok, false)
    assert.ok(result.missing.includes('clientId'))
  })

  it('fails when the final scope is missing for the final-scope stage', () => {
    const result = validatePipelineVariables('FINAL_SCOPE_APPROVED', { ...V, finalScope: null })
    assert.equal(result.ok, false)
    assert.ok(result.missing.includes('finalScope'))
  })

  it('fails when the preview URL is missing for the preview stage', () => {
    const result = validatePipelineVariables('HTML_PREVIEW_SENT', { ...V, htmlPreviewUrl: undefined })
    assert.equal(result.ok, false)
    assert.ok(result.missing.includes('htmlPreviewUrl'))
  })

  it('fails when the meeting link is missing for the meeting stage', () => {
    const result = validatePipelineVariables('MEETING_REQUESTED', { ...V, meetingLink: null })
    assert.equal(result.ok, false)
    assert.ok(result.missing.includes('meetingLink'))
  })

  it('every stage declares at least the Client ID as required', () => {
    for (const stage of PIPELINE_MESSAGE_STAGES) {
      assert.ok(REQUIRED_VARIABLES_BY_STAGE[stage].includes('clientId'), `${stage} must require clientId`)
    }
  })
})

describe('public confidentiality — no Software Factory internals', () => {
  const root = join(process.cwd())

  it('PlatformView does not expose internal factory module names', () => {
    const src = readFileSync(join(root, 'src/components/site/PlatformView.tsx'), 'utf8')
    for (const term of ['Template Library', 'Module Engine', 'Company Provisioning', 'Version Control', 'Deployment & Recovery', 'Software Factory']) {
      assert.ok(!src.includes(term), `PlatformView must not contain "${term}"`)
    }
  })

  it('PlatformView carries the customer-facing headline', () => {
    const src = readFileSync(join(root, 'src/components/site/PlatformView.tsx'), 'utf8')
    assert.ok(src.includes('Your Business. One Connected Platform. Complete Control.'))
  })

  it('AboutView uses USA-based positioning without Bangladesh mentions', () => {
    const src = readFileSync(join(root, 'src/components/site/AboutView.tsx'), 'utf8')
    assert.ok(!src.toLowerCase().includes('bangladesh'), 'AboutView must not mention Bangladesh')
    assert.ok(src.includes('USA-based'))
  })

  it('CareersView does not mention Bangladesh', () => {
    const src = readFileSync(join(root, 'src/components/site/CareersView.tsx'), 'utf8')
    assert.ok(!src.toLowerCase().includes('bangladesh'), 'CareersView must not mention Bangladesh')
  })

  it('homepage hero carries the approved headline', () => {
    const src = readFileSync(join(root, 'src/components/site/HomeView.tsx'), 'utf8')
    assert.ok(src.includes('Engineering Technology.'))
    assert.ok(src.includes('Empowering Business.'))
  })
})
