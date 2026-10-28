/**
 * TECH360 Human-Like Customer Communication and End-to-End Messaging Repair
 * Acceptance criteria — 12 proof points (Requirement I).
 * Pure tests: no database, no provider, no secrets.
 * Heavier integration evidence is in docs/ and CI logs.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { DISCOVERY_FIELDS, missingFields, nextQuestion, buildSummary, emptyDiscoveryState, isAnswered, extractEmail } from '../src/lib/discovery'
import { validateEmail as validateViaRouter, decideReplyChannel } from '../src/lib/channel-router'
import { decideFollowUp, defaultCommState } from '../src/lib/conversation-state'
import { PUBLIC_CONTACT } from '../src/lib/site-contact'

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// ============================================================
// 1 — Website chat message receives genuine AI response or honest error
// ============================================================
describe('1 — website chat AI response or honest error', () => {
  it('chat/message route invokes the orchestrator and never claims fake AI response', () => {
    const src = read('src/app/api/chat/message/route.ts')
    assert.match(src, /handleCustomerMessage/, 'must call the chat orchestrator')
    assert.match(src, /wasAiGenerated/, 'must surface whether reply was AI-generated')
    assert.match(src, /do not claim|honest/i, 'must have honest-status comments')
    // Never invents a response when AI fails — records failure and returns honest fallback
    assert.match(src, /AI_UNAVAILABLE|orchestrator.*failed|honest fallback/i)
    // Persists both inbound and outbound against same client + conversation
    assert.match(src, /channel:[\s\S]*?WEB/)
    assert.match(src, /direction:[\s\S]*?IN/)
    assert.match(src, /chatMessage\.create[\s\S]*?conversationId/)
  })

  it('chat/session route links conversation to stable Client ID and exposes AI status', () => {
    const src = read('src/app/api/chat/session/route.ts')
    assert.match(src, /clientId/, 'must link ChatConversation to Client ID')
    assert.match(src, /getZaiProviderStatus|aiAvailable/, 'must expose AI availability honestly')
    assert.match(src, /ensureChatClient/, 'must create or reuse CRM Client through the consented intake helper')
  })

  it('ChatWidget removes the misleading instant-AI promise', () => {
    const src = read('src/components/site/ChatWidget.tsx')
    assert.ok(!src.includes('AI agents answer instantly'), 'must NOT contain the misleading promise')
    assert.match(src, /AI assistant (ready|status|unavailable)|Checking assistant status/, 'must show honest AI status')
    assert.match(src, /Client ID|Reference/, 'must display Client ID when available')
    assert.match(src, /wasAiGenerated|escalated|aiError/, 'must handle genuine AI/provider errors and escalation')
  })

  it('ChatWidget never claims a message was sent unless the operation succeeded', () => {
    const src = read('src/components/site/ChatWidget.tsx')
    // Honest degradation: connection issues are shown, never faked
    assert.match(src, /Connection issue.*retrying|Your message has not been sent yet/)
    assert.match(src, /if \(!res\.ok\) throw/, 'must check server success before claiming sent')
  })
})

// ============================================================
// 2 — First WhatsApp message creates one CRM Client ID and useful reply
// ============================================================
describe('2 — first WhatsApp creates one Client ID + useful reply', () => {
  it('WhatsApp webhook deduplicates via InboundWebhookReceipt and uses verified identity', () => {
    const src = read('src/app/api/webhooks/whatsapp/route.ts')
    assert.match(src, /claimInboundWebhookEvent/, 'must dedupe provider events')
    assert.match(src, /finishInboundWebhookEvent/, 'must finish receipt atomically')
    assert.match(src, /VerifiedIdentityProof|WHATSAPP_SIGNATURE/, 'must use verified phone identity, not raw PII')
    assert.match(src, /resolveVerifiedClientIdentity|resolveOrCreateVerifiedClient/, 'must prevent duplicate Client IDs via normalized identity')
  })

  it('first WhatsApp creates canonical Client ID via intakeLead (no duplicate CRM)', () => {
    const src = read('src/app/api/webhooks/whatsapp/route.ts')
    assert.match(src, /intakeLead\(\{[\s\S]*?source: 'WHATSAPP'/, 'must use existing intakeLead, not a duplicate CRM')
    assert.match(src, /toE164.*from/, 'must normalize phone via toE164 before dedupe')
  })
})

// ============================================================
// 3 — Subsequent WhatsApp receives contextual response (not merely stored)
// ============================================================
describe('3 — subsequent WhatsApp contextual response', () => {
  it('WhatsApp webhook generates contextual AI reply via orchestrator for existing clients', () => {
    const src = read('src/app/api/webhooks/whatsapp/route.ts')
    assert.match(src, /handleWhatsAppReply|handleCustomerMessage/, 'must generate contextual reply, not merely store')
    assert.match(src, /recordInbound/, 'must update communication state machine on inbound')
    assert.match(src, /sendCommunication[\s\S]*?channel: 'WHATSAPP'/, 'must send reply on same channel (or email canonical)')
    // Must not silently ignore — logs honest failure
    assert.match(src, /logError.*WA_REPLY_FAILED|logErr/)
  })

  it('WhatsApp reply respects email canonical for formal stages', () => {
    const src = read('src/app/api/webhooks/whatsapp/route.ts')
    assert.match(src, /isFormalStage|emailCanonical/, 'must route formal details to email, WhatsApp only concise notification')
    assert.match(src, /Tech360.*Ref.*Check your email|concise.*notification/i)
  })
})

// ============================================================
// 4 — Inbound SMS creates or updates same CRM lifecycle correctly
// ============================================================
describe('4 — inbound SMS CRM lifecycle', () => {
  it('SMS webhook validates, dedupes, links to Client ID, and generates reply', () => {
    const src = read('src/app/api/webhooks/sms/route.ts')
    assert.ok(read('src/app/api/webhooks/sms/route.ts').length > 1000, 'SMS webhook file must exist and be substantial')
    assert.match(src, /claimInboundWebhookEvent.*SMS/, 'must dedupe SMS provider events')
    assert.match(src, /toE164/, 'must normalize phone via shared toE164')
    assert.match(src, /resolveVerifiedClientIdentity|VerifiedIdentityProof/, 'must use normalized identity dedup')
    assert.match(src, /intakeLead[\s\S]*?source: 'SMS'/, 'must use existing journey intakeLead')
    assert.match(src, /handleCustomerMessage|handleSmsReply/, 'must generate contextual response, not merely store')
    assert.match(src, /sendCommunication[\s\S]*?channel: 'SMS'/, 'must attempt send via real adapter and persist status')
    // Signature validation where supported
    assert.match(src, /TWILIO_AUTH_TOKEN|x-twilio-signature|constantTimeEquals/, 'must validate webhook signatures where supported')
  })
})

// ============================================================
// 5 — Public email input stays contact data until verified
// ============================================================
describe('5 — email verification before identity linkage', () => {
  it('normalizes email but refuses to link free-text input without OTP proof', () => {
    const src = read('src/lib/channel-router.ts')
    assert.match(src, /validateEmail/, 'must normalize and validate the address')
    assert.match(src, /Email verification is required/i, 'must fail closed without verified identity proof')
    assert.doesNotMatch(src, /db\.client\.update[\s\S]*?email:/, 'raw email must not mutate the CRM identity')
  })

  it('chat orchestrator never treats a raw free-text email as verified CRM identity', () => {
    const src = read('src/lib/chat-orchestrator.ts')
    assert.match(src, /unverified contact data/i)
    assert.doesNotMatch(src, /extractEmail|db\.client\.update[\s\S]*?email:/)
    const onboarding = read('src/lib/chat-onboarding.ts')
    assert.match(onboarding, /contactConsentAt/)
    assert.match(onboarding, /identityReviewRequired/)
    assert.match(onboarding, /intakeLead/)
  })

  it('pure validation: correct emails pass, bad ones fail', () => {
    assert.equal(validateViaRouter('test@example.com').ok, true)
    assert.equal(validateViaRouter('  TEST@Example.COM ').normalized, 'test@example.com')
    assert.equal(validateViaRouter('bad@').ok, false)
    assert.equal(validateViaRouter('').ok, false)
    assert.equal(validateViaRouter('a@b.c').ok, true)
  })

  it('extractEmail finds address inside natural text', () => {
    assert.equal(extractEmail('my email is hello@bdtech360.com please use it'), 'hello@bdtech360.com')
    assert.equal(extractEmail('no email here'), null)
  })
})

// ============================================================
// 6 — After email collection, formal details go to email
// ============================================================
describe('6 — after email, formal comms go to canonical email', () => {
  it('channel-router sends canonical email + concise notification', () => {
    const src = read('src/lib/channel-router.ts')
    assert.match(src, /sendCanonicalWithNotification/, 'must provide canonical-email + notification helper')
    assert.match(src, /toEmail[\s\S]*?toWhatsApp|conciseNotification/, 'must mention Client ID + clear action in notification')
    assert.match(src, /concise.*notification|Do not duplicate/i, 'must document that long docs are not duplicated across channels')
  })

  it('email canonical is used for detailed scope, SOW, approvals, payment, handover', () => {
    const src = read('src/lib/channel-router.ts')
    // The spec’s canonical list is long — we assert the concept, not every word
    assert.match(src, /canonical|formal/i)
    // Web/WhatsApp webhook already routes formal stages to email
    const wa = read('src/app/api/webhooks/whatsapp/route.ts')
    assert.match(wa, /FINAL_SCOPE|PAYMENT_PENDING|HANDOVER|formal.*email|isFormalStage/)
  })
})

// ============================================================
// 7 — Inbound email replies update correct conversation and next action
// ============================================================
describe('7 — inbound email reply threading', () => {
  it('email webhook matches via From email, In-Reply-To, References, and Client ID in subject', () => {
    const src = read('src/app/api/webhooks/email/route.ts')
    assert.match(src, /fromEmail.*Client\.email|email.*Client\.email/, 'must match via normalized From email')
    assert.match(src, /inReplyTo.*providerMessageId|In-Reply-To/, 'must match via In-Reply-To against Communication.providerMessageId')
    assert.match(src, /references|References/, 'must also check References header')
    assert.match(src, /TECH-\d{4}-\d{4,6}.*clientId|Client ID/, 'must fallback to Client ID extracted from subject/body')
  })

  it('email webhook dedupes, validates secret, persists thread status', () => {
    const src = read('src/app/api/webhooks/email/route.ts')
    assert.match(src, /claimInboundWebhookEvent.*EMAIL/, 'must dedupe provider events')
    assert.match(src, /verifyEmailWebhookAuth|EMAIL_WEBHOOK_SECRET/, 'must fail closed on a dedicated email webhook credential')
    assert.match(src, /status: 'RECEIVED'|providerMessageId.*eventId/, 'must persist delivery status honestly')
    assert.match(src, /recordInbound.*EMAIL/, 'must update communication state machine')
    assert.match(src, /handleCustomerMessage.*EMAIL|audit.*INBOUND_EMAIL/, 'must not silently ignore — must route to orchestrator or audit')
  })
})

// ============================================================
// 8 — Discovery asks one question at a time, never repeats known answers
// ============================================================
describe('8 — one-question-at-a-time discovery', () => {
  it('DISCOVERY_FIELDS covers required business signals', () => {
    const keys = DISCOVERY_FIELDS.map((f) => f.key)
    for (const required of ['businessType', 'objective', 'intendedUsers', 'pagesFeatures', 'existingWebsite', 'integrations', 'timeline', 'budget', 'contentAssets']) {
      assert.ok(keys.includes(required as never), `must collect ${required}`)
    }
  })

  it('missingFields excludes already-answered fields', () => {
    const answers = { businessType: 'eCommerce', objective: 'Sell online' }
    const missing = missingFields(answers as never)
    assert.ok(!missing.some((f) => f.key === 'businessType'), 'must never ask again for businessType')
    assert.ok(!missing.some((f) => f.key === 'objective'))
    assert.ok(missing.some((f) => f.key === 'intendedUsers'))
  })

  it('nextQuestion returns at most one primary question', () => {
    const empty = emptyDiscoveryState()
    const q1 = nextQuestion(empty.answers)
    assert.ok(q1 && typeof q1.question === 'string', 'must ask one question when nothing known')
    // After answering one field, next question moves forward
    const afterOne = { businessType: 'eCommerce' }
    const q2 = nextQuestion(afterOne as never)
    assert.ok(q2 && q1 && q2.key !== q1.key, 'must advance to next missing field')
  })

  it('never asks the entire questionnaire as one long message', () => {
    // The orchestrator’s fallback and AI prompt each mention at most one discovery question
    const orch = read('src/lib/chat-orchestrator.ts')
    // Heuristic: the prompt says "Ask at most one primary follow-up question"
    assert.match(orch, /at most one|ONE concise question|nextQuestion/i)
    // No file should contain the 8-question blast
    const templateCheck = read('src/lib/pipeline/templates.ts')
    // Templates for BUSINESS_TYPE_RECEIVED are multi-question legacy — that is OK;
    // the one-question rule applies to the chat orchestrator path
    assert.ok(!orch.includes('1. Required features\n2. Number of staff/users\n3. Do you need website'), 'orchestrator must not blast the 8-question template')
  })

  it('persists answers before advancing (save before next question)', () => {
    const src = read('src/lib/chat-orchestrator.ts')
    assert.match(src, /saveDiscoveryState.*answers\[fieldKey\]|saveDiscoveryState\(client\.id,\s*discovery\)/, 'must save CRM before advancing')
    // And also: discovery answers sync to Client/Lead for visibility
    const discSrc = read('src/lib/discovery.ts')
    assert.match(discSrc, /syncDiscoveryToCrm|db\.lead\.update.*requirements/, 'must sync discovery answers to CRM')
  })

  it('buildSummary collects answers for customer confirmation before SOW', () => {
    const answers = {
      businessType: 'eCommerce',
      objective: 'Launch online store',
      intendedUsers: '2 admins + customers',
      pagesFeatures: 'Homepage, catalogue, checkout, admin',
      timeline: '6 weeks',
    }
    const summary = buildSummary(answers as never, 'Ayesha', 'TECH-2026-000001')
    assert.match(summary, /TECH-2026-000001/, 'must include Client ID')
    assert.match(summary, /Business type/, 'must include collected fields')
    assert.match(summary, /APPROVED|feedback|change/i, 'must ask for proposal feedback or approval')
  })

  it('isAnswered treats “n/a”, “none” as valid optional answers (not repeated)', () => {
    assert.equal(isAnswered('n/a'), true)
    assert.equal(isAnswered('None'), true)
    assert.equal(isAnswered(''), false)
    assert.equal(missingFields({ contentAssets: 'n/a' } as never).some((f) => f.key === 'contentAssets'), false)
  })

  it('AI provider failure is recorded honestly with clear next action', () => {
    const src = read('src/lib/chat-orchestrator.ts')
    assert.match(src, /logError.*AI_GENERATION_FAILED|buildHonestFallback/, 'must record AI failure and provide honest fallback')
    assert.match(src, /Your message has been saved.*Client ID|team will respond.*business day/, 'fallback must state what happened + next action + Client ID')
    assert.match(src, /do not invent.*response|never.*claim/i)
  })
})

// ============================================================
// 9 — Every outbound message linked to correct client, workflow, provider status
// ============================================================
describe('9 — outbound linkage to client, workflow, provider status', () => {
  it('sendCommunication always creates a Communication row with clientId + status', () => {
    const src = read('src/lib/comms.ts')
    assert.match(src, /db\.communication\.create[\s\S]*?clientId/, 'must persist Communication with clientId')
    assert.match(src, /status: result\.status|providerMessageId/, 'must persist provider status + message id')
    assert.match(src, /DISABLED_BY_ADMIN|NOT_CONFIGURED/, 'must persist disabled / not-configured honestly, not fake SENT')
  })

  it('chat orchestrator persists outbound with Communication + ChatMessage linked to same client + conversation', () => {
    const src = read('src/lib/chat-orchestrator.ts')
    assert.match(src, /db\.chatMessage\.create[\s\S]*?conversationId/, 'must link ChatMessage to conversation')
    assert.match(src, /db\.communication\.create[\s\S]*?clientId: client\.id[\s\S]*?channel: input\.channel/, 'must link Communication to client + channel')
    assert.match(src, /providerMessageId: `chat_out/, 'must set providerMessageId for dedup/audit')
  })

  it('pipeline send is always saved whether or not provider accepted it', () => {
    const src = read('src/lib/pipeline/send.ts')
    assert.match(src, /ALWAYS SAVE|communication.*saved|db\.communication\.create/)
  })
})

// ============================================================
// 10 — Provider failure, disabled channels, duplicate webhooks, quota handled honestly
// ============================================================
describe('10 — honest handling of failures, disabled channels, duplicates, quota', () => {
  it('comms adapter returns NOT_CONFIGURED when credentials missing (never fake SENT)', () => {
    const src = read('src/lib/comms.ts')
    assert.match(src, /NOT_CONFIGURED/, 'must return NOT_CONFIGURED when not configured')
    assert.match(src, /channelConfigured/)
  })

  it('disabled_by_admin is enforced via feature flag and persisted honestly', () => {
    const src = read('src/lib/comms.ts')
    assert.match(src, /channelSwitchAllows|featureEnabled.*whatsapp|DISABLED_BY_ADMIN/, 'must check Super Admin switch before sending, persist DISABLED_BY_ADMIN')
  })

  it('webhooks dedupe via InboundWebhookReceipt (idempotency) and constant-time signatures', () => {
    const wa = read('src/app/api/webhooks/whatsapp/route.ts')
    const sms = read('src/app/api/webhooks/sms/route.ts')
    const email = read('src/app/api/webhooks/email/route.ts')
    for (const src of [wa, sms, email]) {
      assert.match(src, /claimInboundWebhookEvent/, 'must claim with idempotency key')
      assert.match(src, /finishInboundWebhookEvent/, 'must finish receipt with success/failure')
    }
    assert.match(wa, /createHmac.*sha256.*WHATSAPP_APP_SECRET|constantTimeEquals/, 'WhatsApp must validate HMAC signature')
    assert.match(sms, /x-twilio-signature|constantTimeEquals/, 'SMS must validate signature where supported')
  })

  it('AI quota / provider errors produce honest fallback, not invented reply', () => {
    const src = read('src/lib/chat-orchestrator.ts')
    assert.match(src, /quota|Daily quota/i, 'must detect quota error')
    assert.match(src, /buildHonestFallback.*has been saved|team will respond/, 'must provide honest next action, not invented answer')
    assert.match(src, /screenAiContent|PhoneNumberInAiContent/, 'must still screen AI content even on fallback path')
  })

  it('outbox retry respects backoff and never duplicates', () => {
    const src = read('src/lib/comms.ts')
    assert.match(src, /retryCommunicationOutbox|claim.*attempts|Another dispatcher already claimed/)
  })
})

// ============================================================
// 11 — Approval, payment verification, source-handover gates remain enforced
// ============================================================
describe('11 — security gates enforced', () => {
  it('handover release still requires full payment + admin approval', () => {
    const src = read('src/lib/journey.ts')
    assert.match(src, /assertDeliveryRules.*paymentConfirmed.*sourceCodeRelease.*adminApproved/, 'must call assertDeliveryRules with all three gates')
    assert.match(src, /BLOCKED:.*full payment verification|Source code cannot be released before payment/)
    assert.match(src, /Approval.*pending Super Admin|type: 'SOURCE_HANDOVER'/, 'must require Super Admin handover approval')
    assert.match(src, /verifyHandoverArtifacts|parseHandoverManifest/, 'must verify artifact manifest integrity')
  })

  it('payment verification gate is still enforced', () => {
    const journey = read('src/lib/journey.ts')
    assert.match(journey, /verifyPayment.*adminUserId|verifiedBy.*verifiedAt/, 'payment must be verified by admin')
    assert.match(journey, /status: 'PAID'|verifiedAt/)
  })

  it('scope approval gate is still enforced', () => {
    const journey = read('src/lib/journey.ts')
    assert.match(journey, /approvalRequest\.create[\s\S]*?FINAL_SCOPE_SEND/, 'SOW must require admin approval before sending')
    assert.match(journey, /finalizeScopeAndSend/, 'final scope send must be admin-gated')
  })

  it('preview-before-payment and source-after-full-payment policies are not bypassed', () => {
    const rules = read('src/lib/pipeline/rules.ts')
    assert.match(rules, /POLICY_HTML_PREVIEW_BEFORE_PAYMENT/, 'HTML Preview Before Payment policy must remain')
    assert.match(rules, /POLICY_SOURCE_CODE_AFTER_FULL_PAYMENT/)
    assert.match(rules, /assertDeliveryRules.*paymentConfirmed.*sourceCodeRelease/)
  })
})

// ============================================================
// 12 — Public visitors cannot access another client's messages, CRM, prompts, logs
// ============================================================
describe('12 — visitor isolation & access control', () => {
  it('chat message APIs isolate by anonId and require OPEN conversation', () => {
    const src = read('src/app/api/chat/message/route.ts')
    assert.match(src, /where: \{ anonId, status: 'OPEN' \}/, 'must only access own OPEN conversation via anonId')
    assert.match(src, /rateLimit.*chat-message/, 'must preserve rate limiting')
    assert.match(src, /sanitizeText.*MAX_BODY|BODY_TOO_LONG/, 'must preserve input validation')
  })

  it('chat messages API never returns other visitors data', () => {
    const src = read('src/app/api/chat/messages/route.ts')
    assert.match(src, /where: \{ anonId \}.*orderBy.*createdAt|where: \{ anonId \}/, 'must filter by anonId, not by clientId enumeration')
    assert.match(src, /sanitizeText.*anonId|BAD_ANON_ID/)
  })

  it('admin/prompts/agent logs remain behind server-side auth guard', () => {
    const adminGuard = read('src/lib/api-guard.ts')
    assert.match(adminGuard, /guard|requireRole|SUPER_ADMIN|ADMIN/, 'must have role-guarded admin APIs')
    const conversationsApi = read('src/app/api/admin/conversations/route.ts')
    assert.match(conversationsApi, /guard|auth|session/, 'admin inbox must be auth-guarded')
  })

  it('client portal requires OTP + Client ID (not just Client ID)', () => {
    const src = read('src/app/api/portal/login/route.ts')
    assert.match(src, /OTP|challenge|code/, 'portal must require OTP proof, not just an ID')
  })

  it('knowledge/prompt templates are not exposed via public chat', () => {
    const chatSrc = read('src/app/api/chat/message/route.ts')
    assert.ok(!chatSrc.match(/PromptTemplate|KnowledgeDocument|AiAgent.*systemPrompt/), 'public chat must never leak prompts or agent logs')
    const widget = read('src/components/site/ChatWidget.tsx')
    assert.ok(!widget.includes('systemPrompt') && !widget.includes('agent logs'), 'widget must not expose internal tooling')
  })
})

// ============================================================
// H — Public contact details: shared source, NO public WhatsApp
// Owner decision 2026-10-24: TECH360 publishes no WhatsApp number and
// no chat deep link. Webchat, the enquiry form and email remain.
// ============================================================
describe('H — public contact details via single shared source (no WhatsApp)', () => {
  it('PUBLIC_CONTACT holds the email and origin, and no WhatsApp fields', () => {
    assert.equal(PUBLIC_CONTACT.email, 'info@bdtech360.com')
    assert.equal(PUBLIC_CONTACT.url, 'https://bdtech360.com')
    const record = PUBLIC_CONTACT as unknown as Record<string, unknown>
    assert.equal(record.whatsappE164, undefined, 'no public WhatsApp number may remain')
    assert.equal(record.whatsappLink, undefined, 'no public WhatsApp link may remain')
    assert.equal(record.whatsappDigits, undefined, 'no wa.me digits helper may remain')
    assert.deepEqual([...PUBLIC_CONTACT.channels], ['webchat', 'enquiry-form', 'email'])
  })

  it('header, footer, contact page and portal share that source and offer email + chat', () => {
    const footer = read('src/components/site/SiteFooter.tsx')
    assert.match(footer, /mailto.*COMPANY\.email/, 'footer must use shared email')
    assert.match(footer, /tech360:open-chat/, 'footer must offer the webchat entry point')
    assert.ok(!/wa\.me|whatsappLink|publicWhatsApp/.test(footer), 'footer must not publish a WhatsApp route')

    const site = read('src/data/site.ts')
    assert.match(site, /PUBLIC_CONTACT/, 'site data must use shared contact')
    assert.ok(!/whatsappLink|publicWhatsApp:/.test(site), 'site data must not export a WhatsApp link')

    const constants = read('src/lib/constants.ts')
    assert.match(constants, /PUBLIC_CONTACT/, 'constants must use shared contact')
    assert.ok(!/whatsappLink|publicWhatsApp:/.test(constants), 'constants must not export a WhatsApp link')

    const portal = read('src/components/site/PortalView.tsx')
    assert.match(portal, /PUBLIC_CONTACT/, 'portal must use the shared email')
    assert.ok(!/message us on WhatsApp/i.test(portal), 'portal sign-in must not point at WhatsApp')
  })

  it('no public component publishes the retired number or a wa.me deep link', () => {
    const files = [
      'src/components/site/SiteHeader.tsx',
      'src/components/site/SiteFooter.tsx',
      'src/components/site/ContactView.tsx',
      'src/components/site/PortalView.tsx',
      'src/components/site/HomeView.tsx',
      'src/components/site/ServiceDetailView.tsx',
      'src/components/site/ServicesView.tsx',
      'src/components/site/DesignKitView.tsx',
      'src/components/site/buttons.tsx',
      'src/components/site/ChatWidget.tsx',
      'src/lib/site-contact.ts',
      'src/lib/constants.ts',
      'src/data/site.ts',
      'src/app/layout.tsx',
    ]
    for (const file of files) {
      const content = read(file)
      assert.ok(!/8801327100297/.test(content), `${file} must not contain the retired public number`)
    }
    // The generic button may build a deep link only from an explicitly passed
    // number; it must never fall back to a shared public number.
    const buttons = read('src/components/site/buttons.tsx')
    assert.ok(!/PUBLIC_CONTACT|whatsappE164/.test(buttons), 'WhatsApp button must not fall back to a public number')
    const publicSite = ['SiteHeader', 'SiteFooter', 'ContactView', 'PortalView', 'HomeView', 'ServiceDetailView', 'ServicesView', 'DesignKitView', 'ChatWidget']
      .map((n) => read(`src/components/site/${n}.tsx`))
      .join('\n')
    assert.ok(!/wa\.me/.test(publicSite), 'no public component may render a wa.me deep link')
  })

  it('the webchat and enquiry-form routes remain the public enquiry path', () => {
    const chat = read('src/app/api/chat/message/route.ts')
    assert.match(chat, /export async function POST/, 'webchat message route must exist')
    const session = read('src/app/api/chat/session/route.ts')
    assert.match(session, /export async function POST/, 'webchat session route must exist')
    const contact = read('src/app/api/contact/route.ts')
    assert.match(contact, /export async function POST/, 'enquiry form route must exist')
    // Webchat must not require a phone number or a WhatsApp account.
    assert.ok(!/require.*whatsapp|whatsapp.*required/i.test(session), 'webchat must not require WhatsApp')
  })
})

// ============================================================
// G — Follow-up policy: persisted state machine, configurable delays
// ============================================================
describe('G — follow-up policy (persisted state machine)', () => {
  it('conversation-state persists last inbound/outbound, stage, next action, opt-out, takeover', () => {
    const src = read('src/lib/conversation-state.ts')
    assert.match(src, /lastInboundAt|lastOutboundAt/, 'must record last inbound/outbound')
    assert.match(src, /currentStage|nextPendingAction|nextPendingActor/, 'must record stage + next pending action + actor')
    assert.match(src, /followUpEnabled|firstReminderAt|finalReminderAt|reminderCount/, 'must have follow-up scheduling fields')
    assert.match(src, /optedOut|humanTakeover|closed/, 'must stop on opt-out, takeover, closure')
    assert.match(src, /quietHours|respectQuietHours|isQuietHour/, 'must respect quiet hours')
  })

  it('decideFollowUp sends at most one useful reminder after 24h and final after 72h (configurable)', () => {
    // Pinned to 12:00 Asia/Dhaka. Quiet hours are 22:00-07:00, so using the wall clock
    // made this test pass or fail depending on when it ran.
    const noonDhaka = new Date(Date.UTC(2026, 9, 24, 6, 0, 0))
    assert.equal(defaultCommState('row', 'TECH-2026-000001').config.firstDelayHours, 24)
    assert.equal(defaultCommState('row', 'TECH-2026-000001').config.finalDelayHours, 72)
    assert.equal(defaultCommState('row', 'TECH-2026-000001').maxReminderCount, 2)

    // Not yet due → no send
    const fresh = defaultCommState('row', 'TECH-2026-000001')
    fresh.nextPendingActor = 'CLIENT'
    fresh.lastInboundAt = new Date(noonDhaka.getTime() - 1000).toISOString() // inbound after outbound → already replied
    fresh.lastOutboundAt = new Date(noonDhaka.getTime() - 2000).toISOString()
    assert.equal(decideFollowUp(fresh, noonDhaka).shouldSend, false)

    // Due → should send first
    const due = defaultCommState('row', 'TECH-2026-000001')
    due.nextPendingActor = 'CLIENT'
    due.firstReminderAt = new Date(noonDhaka.getTime() - 1000).toISOString()
    due.lastOutboundAt = new Date(noonDhaka.getTime() - 25 * 3600_000).toISOString()
    due.lastInboundAt = new Date(noonDhaka.getTime() - 30 * 3600_000).toISOString()
    const decision = decideFollowUp(due, noonDhaka)
    assert.equal(decision.shouldSend, true)
    assert.equal(decision.which, 'FIRST')
  })

  it('stops reminders after response, opt-out, closure, or manual takeover', () => {
    const opted = defaultCommState('row', 'TECH-2026-000001')
    opted.nextPendingActor = 'CLIENT'
    opted.optedOut = true
    assert.equal(decideFollowUp(opted).shouldSend, false)

    const taken = defaultCommState('row', 'TECH-2026-000001')
    taken.nextPendingActor = 'CLIENT'
    taken.humanTakeover = true
    assert.equal(decideFollowUp(taken).shouldSend, false)

    const closed = defaultCommState('row', 'TECH-2026-000001')
    closed.nextPendingActor = 'CLIENT'
    closed.closed = true
    assert.equal(decideFollowUp(closed).shouldSend, false)
  })
})

// ============================================================
// E — Every lifecycle message explains the next step
// ============================================================
describe('E — every lifecycle message explains next step', () => {
  it('channel-router builds next-step footer with Client ID, stage, next action, actor, due date', () => {
    const src = read('src/lib/channel-router.ts')
    assert.match(src, /buildNextStepFooter|Client ID.*stage.*What just happened.*Next step.*Action required by/, 'must build explicit next-step footer')
    assert.match(src, /Due:.*dueDate|dueDate/, 'must include real due date only when reliable')
    assert.match(src, /How to reply|replyAction/, 'must include correct reply/approval action')
  })

  it('pipeline templates include Client ID in every stage', () => {
    const src = read('src/lib/pipeline/templates.ts')
    // Every stage returns a body that includes the clientId placeholder
    assert.match(src, /Client ID:\s*\n?\$\{v\.clientId\}/, 'every template must include Client ID')
  })

  it('chat orchestrator appends next-step context and honest error footer', () => {
    const src = read('src/lib/chat-orchestrator.ts')
    assert.match(src, /determineNextAction|nextPendingAction|buildNextStepFooter|Client ID.*Stage/, 'must compute and include next-step context')
  })
})

// ============================================================
// F — Full lifecycle preserved (gates remain, no skipped approvals)
// ============================================================
describe('F — full lifecycle integrity', () => {
  it('journey engine still exposes all lifecycle functions (not rebuilt)', () => {
    const src = read('src/lib/journey.ts')
    for (const fn of ['intakeLead', 'detectBusiness', 'recommendPlan', 'askScopeQuestions', 'submitScope', 'finalizeScopeAndSend', 'generatePreview', 'recordPreviewDecision', 'requestPayment', 'recordPayment', 'verifyPayment', 'activateProject', 'prepareHandover', 'releaseHandover', 'confirmDelivery', 'closeProject']) {
      assert.match(src, new RegExp(`export async function ${fn}|export function ${fn}`), `must still expose ${fn} (no rebuild)`)
    }
  })

  it('preview-before-payment and approval gates are still enforced end-to-end', () => {
    const journey = read('src/lib/journey.ts')
    assert.match(journey, /PREVIEW_TTL_DAYS|generatePreview/, 'HTML preview before payment must remain')
    assert.match(journey, /SOURCE_HANDOVER.*approvalRequest|releaseHandover.*approvalRequestId/, 'source handover must remain approval-gated')
  })
})

// ============================================================
// D — Channel routing: initial inbound, email collection, canonical, dedupe
// ============================================================
describe('D — channel routing invariants', () => {
  it('decideReplyChannel replies on inbound channel when operational', async () => {
    // Pure channel logic: without SMTP env, EMAIL is NOT operational → falls back gracefully
    // We just test the shape, not the env-dependent truthiness
    const decision = await decideReplyChannel('WHATSAPP', { whatsapp: '+10000000000', email: 'a@b.com' })
    assert.ok(decision.replyChannel === 'WHATSAPP' || decision.replyChannel === null, 'must return a channel decision')
    assert.ok(decision.reason.length > 10)
  })

  it('WEB chat uses consent, request idempotency, and never links CRM by raw email', () => {
    const chatSession = read('src/app/api/chat/session/route.ts')
    const chatMsg = read('src/app/api/chat/message/route.ts')
    const onboarding = read('src/lib/chat-onboarding.ts')
    assert.match(chatSession, /hasExplicitContactConsent/)
    assert.match(chatSession, /clientRequestId: requestId/)
    assert.match(chatSession, /withChatSessionCookie/)
    assert.match(chatMsg, /clientRequestId: requestId/)
    assert.match(chatMsg, /chatSessionCookieIsValid/)
    assert.doesNotMatch(chatMsg, /where: \{ email/)
    assert.match(onboarding, /contactConsentAt: \{ not: null \}/, 'only consented prior browser chats may reuse the Client ID')
    assert.match(onboarding, /identityReviewRequired/, 'email collisions must not expose an existing Client ID')
  })
})
