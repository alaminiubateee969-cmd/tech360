/** Marketing Dashboard: idea->plan builder, presence-only
 *  connection status, and honest publishing adapters (mocked
 *  fetch — PUBLISHED only with a platform post id). */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildMarketingPlan } from '../src/lib/social/plan'
import { allPlatformStatuses, platformStatus } from '../src/lib/social/platforms'
import { publishPost, verifyPlatform } from '../src/lib/social/publish'

const FB_ENV = { META_APP_ID: 'a', META_APP_SECRET: 's', META_PAGE_ID: '123', META_PAGE_ACCESS_TOKEN: 'tok', INSTAGRAM_BUSINESS_ACCOUNT_ID: 'ig1' }
const X_ENV = { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' }
const LI_ENV = { LINKEDIN_CLIENT_ID: 'c', LINKEDIN_CLIENT_SECRET: 's', LINKEDIN_ORGANIZATION_ID: '42', LINKEDIN_ACCESS_TOKEN: 'tok' }

const fakeFetch = (handler: (url: string, init?: RequestInit) => { ok: boolean; status: number; body: unknown }) =>
  (async (url: string, init?: RequestInit) => {
    const r = handler(String(url), init)
    return { ok: r.ok, status: r.status, json: async () => r.body } as Response
  }) as typeof fetch

describe('idea -> marketing plan', () => {
  it('builds drafts for every selected platform with image + video prompts', () => {
    const plan = buildMarketingPlan({ idea: 'Create 7 posts for CRM automation', language: 'BOTH', platforms: ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X'] })
    assert.equal(plan.drafts.length, 4)
    assert.ok(plan.imagePrompt.includes('CRM automation'))
    assert.equal(plan.videoPlan.aspect, '9:16')
    assert.ok(plan.videoPlan.shots.length >= 4)
    assert.ok(plan.whatsappReply.length > 10)
    for (const d of plan.drafts) assert.ok(d.mediaPrompt.length > 10, d.platform)
  })
  it('keeps X drafts within 280 characters including hashtags', () => {
    const plan = buildMarketingPlan({ idea: 'A very long idea about automating every part of a growing business with dashboards reports follow ups invoicing content and customer support workflows', platforms: ['X'] })
    assert.ok(plan.drafts[0].text.length <= 280, `got ${plan.drafts[0].text.length}`)
  })
  it('defaults to Facebook/Instagram/LinkedIn/X and never invents metrics', () => {
    const plan = buildMarketingPlan({ idea: 'New SEO service launch' })
    assert.deepEqual(plan.drafts.map((d) => d.platform), ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X'])
    assert.ok(!/\d+% (more|increase|growth)/i.test(JSON.stringify(plan)))
    assert.equal(plan.source, 'local-draft')
  })
})

describe('connection status (presence only)', () => {
  it('reports NOT_CONFIGURED with the exact missing env names', () => {
    const s = platformStatus('FACEBOOK', {})
    assert.equal(s.state, 'NOT_CONFIGURED')
    assert.deepEqual(s.missingEnv, ['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ID', 'META_PAGE_ACCESS_TOKEN'])
  })
  it('reports CONNECTED when all required credentials are present, PARTIAL in between', () => {
    assert.equal(platformStatus('FACEBOOK', FB_ENV).state, 'CONNECTED')
    assert.equal(platformStatus('FACEBOOK', { META_PAGE_ID: '1' }).state, 'PARTIAL')
    assert.equal(allPlatformStatuses({}).every((p) => p.state === 'NOT_CONFIGURED'), true)
  })
  it('status output never contains credential values', () => {
    const secret = ['val', 'alpha', '991'].join('-')
    const blob = JSON.stringify(platformStatus('FACEBOOK', { ...FB_ENV, META_PAGE_ACCESS_TOKEN: secret, META_APP_SECRET: secret }))
    assert.ok(!blob.includes(secret))
  })
})

describe('publishing adapters (mocked platform APIs)', () => {
  it('refuses to publish without credentials — NOT_CONFIGURED, fetch never called', async () => {
    let calls = 0
    const res = await publishPost({ platform: 'FACEBOOK', text: 'hi' }, {}, (async () => { calls += 1; throw new Error('no') }) as typeof fetch)
    assert.equal(res.status, 'NOT_CONFIGURED')
    assert.equal(calls, 0)
  })
  it('Facebook publishes only with a returned post id and builds the post URL', async () => {
    const res = await publishPost({ platform: 'FACEBOOK', text: 'Hello' }, FB_ENV, fakeFetch(() => ({ ok: true, status: 200, body: { id: '123_456' } })))
    assert.equal(res.status, 'PUBLISHED')
    assert.equal(res.externalId, '123_456')
    assert.match(res.externalUrl!, /facebook\.com\/123_456/)
  })
  it('Facebook API rejection is FAILED, never published', async () => {
    const res = await publishPost({ platform: 'FACEBOOK', text: 'Hello' }, FB_ENV, fakeFetch(() => ({ ok: false, status: 400, body: { error: { message: 'bad token' } } })))
    assert.equal(res.status, 'FAILED')
    assert.match(res.error!, /400/)
  })
  it('Instagram requires media and runs container -> publish', async () => {
    const noMedia = await publishPost({ platform: 'INSTAGRAM', text: 'cap' }, FB_ENV, fakeFetch(() => ({ ok: true, status: 200, body: { id: 'x' } })))
    assert.equal(noMedia.status, 'FAILED')
    const seen: string[] = []
    const res = await publishPost({ platform: 'INSTAGRAM', text: 'cap', mediaUrl: 'https://cdn.example.com/a.jpg' }, FB_ENV, fakeFetch((url) => {
      seen.push(url)
      return url.endsWith('/media') ? { ok: true, status: 200, body: { id: 'container1' } } : { ok: true, status: 200, body: { id: 'post1' } }
    }))
    assert.equal(res.status, 'PUBLISHED')
    assert.equal(seen.length, 2)
  })
  it('LinkedIn posts to the organization URN', async () => {
    let auth = ''
    const res = await publishPost({ platform: 'LINKEDIN', text: 'Hello LI' }, LI_ENV, fakeFetch((_u, init) => {
      auth = String((init?.headers as Record<string, string>)?.Authorization ?? '')
      return { ok: true, status: 201, body: { id: 'urn:li:share:1' } }
    }))
    assert.equal(res.status, 'PUBLISHED')
    assert.equal(auth, ['Bearer', 'tok'].join(' '))
  })
  it('X posts with an OAuth 1.0a Authorization header and truncates to 280', async () => {
    let auth = ''
    let sentText = ''
    const res = await publishPost({ platform: 'X', text: 'x'.repeat(400) }, X_ENV, fakeFetch((_u, init) => {
      auth = String((init?.headers as Record<string, string>)?.Authorization ?? '')
      sentText = String((JSON.parse(String(init?.body)) as { text: string }).text)
      return { ok: true, status: 201, body: { data: { id: '999' } } }
    }))
    assert.equal(res.status, 'PUBLISHED')
    assert.match(auth, /^OAuth oauth_consumer_key=/)
    assert.ok(sentText.length <= 280)
    assert.match(res.externalUrl!, /x\.com/)
  })
  it('YouTube/TikTok stay NOT_CONFIGURED until upload OAuth is verified', async () => {
    const res = await publishPost({ platform: 'YOUTUBE', text: 'v' }, { YOUTUBE_ACCESS_TOKEN: 't', YOUTUBE_CHANNEL_ID: 'c' }, fakeFetch(() => ({ ok: true, status: 200, body: {} })))
    assert.equal(res.status, 'NOT_CONFIGURED')
  })
  it('verify checks identity endpoints and reports failures honestly', async () => {
    const ok = await verifyPlatform('FACEBOOK', FB_ENV, fakeFetch(() => ({ ok: true, status: 200, body: { name: 'Tech360 Page' } })))
    assert.equal(ok.ok, true)
    assert.match(ok.detail, /Tech360 Page/)
    const bad = await verifyPlatform('X', X_ENV, fakeFetch(() => ({ ok: false, status: 401, body: {} })))
    assert.equal(bad.ok, false)
  })
})
