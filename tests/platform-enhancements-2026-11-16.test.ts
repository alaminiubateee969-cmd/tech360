import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveAgentProvider, getAgentProviderStatus, listAgentProviders } from '@/lib/agents/provider-selection'
import { AI_SERVICES } from '@/lib/free-ai-services'
import { ENTERPRISE_CONSTITUTIONAL_RULES, constitutionalRuleStats, defaultGovernanceRules } from '@/lib/governance/rules'
import { WORKFORCE, validateWorkforce } from '@/lib/agents/workforce'
import { LOGICAL_AGENT_CATALOGUE } from '@/lib/agents/catalogue'
import { SKILL_CATALOG } from '@/lib/skills/catalog'
import { SOP_LIBRARY } from '@/lib/sops/library'
import { promptLibraryIndex } from '@/lib/prompts/library'
import { DEPARTMENTS } from '@/lib/agents/registry'
import { isAuthorizedEmailDestination, recordEmailDestination, recordSentEmailDocumentArchive } from '@/lib/document-storage'

const ROOT = resolve(__dirname, '..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

describe('Platform enhancements — multi-provider AI, Agent config, Portal self-service, CRM import, and 3D hero', () => {
  it('resolves OpenAI, Gemini, Groq, OpenRouter, AI Gateway, and ZAI providers and honours AI_PROVIDER override', () => {
    assert.equal(resolveAgentProvider({ OPENAI_API_KEY: 'sk-test' }), 'openai')
    assert.equal(resolveAgentProvider({ GEMINI_API_KEY: 'AIza-test' }), 'gemini')
    assert.equal(resolveAgentProvider({ GROQ_API_KEY: 'gsk-test' }), 'groq')
    assert.equal(
      resolveAgentProvider({
        OPENAI_API_KEY: 'sk-test',
        GROQ_API_KEY: 'gsk-test',
        AI_PROVIDER: 'groq',
      }),
      'groq',
    )
    const listed = listAgentProviders({ OPENAI_API_KEY: 'sk-test' })
    assert.equal(listed.length, 6)
    assert.equal(listed.find((p) => p.kind === 'openai')?.configured, true)
    assert.ok(AI_SERVICES.some((s) => s.name === 'OpenAI API'))
    assert.ok(AI_SERVICES.some((s) => s.name === 'Google AI Studio (Gemini)'))
    assert.ok(AI_SERVICES.some((s) => s.name === 'Groq'))

    const disabledStatus = getAgentProviderStatus({ OPENAI_API_KEY: 'sk-test', AI_PROVIDER: 'none' })
    assert.equal(disabledStatus.state, 'NOT_CONFIGURED')
    assert.equal(disabledStatus.configured, false)
  })

  it('supports per-agent model & dailyQuota updates in PATCH /api/admin/agents/[code] and AgentsView UI', () => {
    const routeSrc = read('src/app/api/admin/agents/[code]/route.ts')
    assert.match(routeSrc, /update_config/)
    assert.match(routeSrc, /dailyQuota/)
    assert.match(routeSrc, /AGENT_CONFIG_UPDATED/)

    const viewSrc = read('src/components/admin/AgentsView.tsx')
    assert.match(viewSrc, /update_config/)
    assert.match(viewSrc, /dailyQuota/)
    assert.match(viewSrc, /resetTokensToday/)
  })

  it('exposes all 6 external AI providers in /api/models, ModelsView, and /api/admin/integrations', () => {
    const modelsRouteSrc = read('src/app/api/models/route.ts')
    assert.match(modelsRouteSrc, /agentProviders/)
    assert.match(modelsRouteSrc, /listAgentProviders/)

    const modelsViewSrc = read('src/components/admin/ModelsView.tsx')
    assert.match(modelsViewSrc, /agentProviders/)
    assert.match(modelsViewSrc, /defaultModel/)

    const integrationsSrc = read('src/app/api/admin/integrations/route.ts')
    assert.match(integrationsSrc, /id:\s*'openai'/)
    assert.match(integrationsSrc, /id:\s*'gemini'/)
    assert.match(integrationsSrc, /id:\s*'groq'/)
  })

  it('implements Client Portal profile updates, scope feedback, support tickets, payment proof submission, and activity history', () => {
    const portalMeSrc = read('src/app/api/portal/me/route.ts')
    assert.match(portalMeSrc, /export async function PATCH/)
    assert.match(portalMeSrc, /export async function POST/)
    assert.match(portalMeSrc, /scope_feedback/)
    assert.match(portalMeSrc, /support_ticket/)
    assert.match(portalMeSrc, /activityHistory/)

    const portalPaymentSrc = read('src/app/api/portal/payments/submit/route.ts')
    assert.match(portalPaymentSrc, /PAYMENT_PROOF_SUBMITTED/)
    assert.match(portalPaymentSrc, /DUPLICATE_TRANSACTION_ID/)
    assert.match(portalPaymentSrc, /standaloneAmount/)

    const portalViewSrc = read('src/components/site/PortalView.tsx')
    assert.match(portalViewSrc, /ScopeFeedbackPanel/)
    assert.match(portalViewSrc, /PaymentProofSubmitPanel/)
    assert.match(portalViewSrc, /SupportTicketForm/)
    assert.match(portalViewSrc, /ProfileSettingsCard/)
    assert.match(portalViewSrc, /ActivityHistoryCard/)
  })

  it('supports manual CRM Lead/Client creation, duplicate detection, bulk update, and CSV import in POST /api/admin/clients and LeadsView', () => {
    const clientsRouteSrc = read('src/app/api/admin/clients/route.ts')
    assert.match(clientsRouteSrc, /export async function POST/)
    assert.match(clientsRouteSrc, /LEADS_IMPORTED/)
    assert.match(clientsRouteSrc, /CLIENT_CREATED/)
    assert.match(clientsRouteSrc, /CLIENTS_BULK_UPDATED/)
    assert.match(clientsRouteSrc, /DUPLICATE_CLIENT/)
    assert.match(clientsRouteSrc, /DUPLICATE_IN_FLIGHT/)
    assert.match(clientsRouteSrc, /skippedDuplicates/)
    assert.match(clientsRouteSrc, /nextClientId/)

    const leadsViewSrc = read('src/components/admin/LeadsView.tsx')
    assert.match(leadsViewSrc, /Import CSV/)
    assert.match(leadsViewSrc, /Create Lead \/ Client/)
  })

  it('enforces 8 governance gates and supports show_failing_agents and create_lead in the NL Command Center', () => {
    const cmdSrc = read('src/app/api/admin/command/route.ts')
    assert.match(cmdSrc, /NL_COMMAND_GOVERNANCE_GATES/)
    assert.match(cmdSrc, /show_failing_agents/)
    assert.match(cmdSrc, /create_lead/)
    assert.match(cmdSrc, /gatesPassed/)
  })

  it('includes the interactive 3D architecture stack showcase on the public homepage hero and Connected Product Ecosystem on PlatformView', () => {
    const homeViewSrc = read('src/components/site/HomeView.tsx')
    assert.match(homeViewSrc, /Hero3dArchitectureShowcase/)
    assert.match(homeViewSrc, /perspective:\s*"1100px"/)
    assert.match(homeViewSrc, /transformStyle:\s*"preserve-3d"/)

    const platformViewSrc = read('src/components/site/PlatformView.tsx')
    assert.match(platformViewSrc, /ECOSYSTEM_MODULES/)
    assert.match(platformViewSrc, /TECH360 Operations/)

    // Verify neutral operational wording and zero prohibited AI branding phrases in HomeView/PlatformView/PortalView
    for (const file of ['src/components/site/HomeView.tsx', 'src/components/site/PlatformView.tsx', 'src/components/site/PortalView.tsx']) {
      const content = read(file)
      assert.doesNotMatch(content, /Powered by AI|Created with AI|AI Generated|AI Workforce|AI Chatbot|Generated by AI/i)
    }
  })

  it('enforces authorized email destination checks and exact sent email document archiving', async () => {
    const sendRouteSrc = read('src/app/api/admin/communications/send/route.ts')
    assert.match(sendRouteSrc, /UNAPPROVED_EMAIL_DESTINATION/)
    assert.match(sendRouteSrc, /recordSentEmailDocumentArchive/)
    assert.match(sendRouteSrc, /portalFileRecordId/)

    const portalMeSrc = read('src/app/api/portal/me/route.ts')
    assert.match(portalMeSrc, /officialDocuments/)
    assert.match(portalMeSrc, /sentDocumentArchives/)
    assert.match(portalMeSrc, /emailDestinations/)

    // Primary email on record is authorized automatically
    const primaryRes = await isAuthorizedEmailDestination({
      clientPrimaryEmail: 'founder@acme.test',
      clientPublicId: 'TECH-2026-999901',
      recipientEmail: 'FOUNDER@acme.test',
    })
    assert.equal(primaryRes.authorized, true)

    // Unlisted thread email is rejected
    const unlistedRes = await isAuthorizedEmailDestination({
      clientPrimaryEmail: 'founder@acme.test',
      clientPublicId: 'TECH-2026-999901',
      recipientEmail: 'stranger-in-thread@acme.test',
    })
    assert.equal(unlistedRes.authorized, false)

    // Recording an authorized destination and an email document archive
    const dest = await recordEmailDestination({
      clientId: 'client_test_1',
      clientPublicId: 'TECH-2026-999901',
      projectId: null,
      recipientName: 'Accounts Payable',
      email: 'ap@acme.test',
      purpose: 'FINANCE_CONTACT',
      authorizationStatus: 'AUTHORIZED',
      active: true,
      verified: true,
      consentEvidence: 'Signed SOW §4.2 billing contact',
      authorizedBy: 'admin@bdtech360.com',
    })
    assert.equal(dest.email, 'ap@acme.test')

    const arc = await recordSentEmailDocumentArchive({
      communicationId: 'comm_test_1',
      clientId: 'client_test_1',
      clientPublicId: 'TECH-2026-999901',
      projectId: 'proj_test_1',
      subject: 'Approved Scope of Work v1',
      finalEmailBody: 'Please find the approved Scope of Work v1 attached.',
      documentId: 'SOW-2026-0001',
      documentVersion: 1,
      documentSha256: 'abc123sha256',
      portalFileRecordId: 'file_test_1',
      attachments: [{ fileRecordId: 'file_test_1', filename: 'SOW-2026-0001.html', mimeType: 'text/html', size: 1024, sha256: 'abc123sha256' }],
      recipientEmail: 'founder@acme.test',
      cc: ['ap@acme.test'],
      bcc: [],
      sentAt: new Date().toISOString(),
      senderAccount: 'admin@bdtech360.com',
      approvalId: 'appr_test_1',
      deliveryStatus: 'SENT',
      providerMessageId: 'msg_123',
      failureInfo: null,
    })
    assert.equal(arc.documentId, 'SOW-2026-0001')
    assert.equal(arc.auditEvents.length, 1)
  })

  it('maintains 550 versioned Constitutional & Layered Governance Rules (>= 500 target) and complete enterprise workforce catalogues', () => {
    const stats = constitutionalRuleStats()
    assert.equal(ENTERPRISE_CONSTITUTIONAL_RULES.length, 550)
    assert.equal(stats.total, 550)
    assert.ok(stats.total >= 500)
    assert.equal(stats.byCategory.CONSTITUTIONAL_CORE, 10)
    assert.equal(stats.byCategory.COMPANY_POLICY, 5)
    assert.equal(stats.byCategory.DEPARTMENT_BOUNDARY, 440)
    assert.equal(stats.byCategory.ROLE_AUTHORITY, 80)
    assert.equal(stats.byCategory.TASK_SAFETY, 15)
    assert.equal(defaultGovernanceRules().length, 5)

    // Verify 110 preserved departments, 2,201 AI Employees, 2,200+1 Logical Agents, 10,010 Skills, 70,400 Prompts, 550 SOPs
    assert.equal(DEPARTMENTS.length, 110)
    assert.equal(WORKFORCE.length, 2201)
    assert.equal(validateWorkforce().valid, true)
    assert.equal(LOGICAL_AGENT_CATALOGUE.length, 2200)
    assert.equal(SKILL_CATALOG.length, 10010)
    assert.equal(SOP_LIBRARY.length, 550)
    assert.equal(promptLibraryIndex(20).size, 70400)
  })
})
