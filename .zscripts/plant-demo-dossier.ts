// PLANTED DEMO DOSSIER — REBUILD-C verification aid.
// The AI provider is currently 429-exhausted, so the UI needs a stored
// dossier to render its success state. This plants one for the demo
// client TECH-2026-000001, honestly labelled via executionId
// 'demo-planted-2026-09-17' (visible in the AI Research tab evidence
// line). Safe to re-run (upsert by scope+key+client).
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const clientId = 'TECH-2026-000001'
const client = await db.client.findFirst({ where: { clientId } })
if (!client) throw new Error(`Demo client ${clientId} not found`)

const dossier = {
  companySnapshot:
    'Test eCommerce Company is a US-based boutique online retailer operating through TECH-2026-000001, engaged via the website contact form. The engagement centers on a website rebuild with integrated automation — a service-first small business profile rather than an enterprise buyer.',
  industryAnalysis:
    'Small e-commerce in the consumer retail vertical. Typical pain: cart abandonment, manual order handling, no automation between store and CRM. Buyers at this size care about fast wins: storefront performance, payment flow, and back-office time savings.',
  recommendedServices: [
    {
      service: 'Custom Software Development',
      reasoning: 'The stated website-rebuild goal maps to the core custom build service with automation hooks.',
    },
    {
      service: 'Automation & Workflow Integration',
      reasoning: 'Manual processes mentioned in requirements are the clearest efficiency win.',
    },
    {
      service: 'Website Redesign & Performance',
      reasoning: 'Slow legacy site indicated — a focused performance pass delivers visible results fast.',
    },
  ],
  budgetExpectation:
    'Budget range stated in intake suggests a mid-four-figure project with milestone payments; willingness to pay increases with demonstrable ROI on automation.',
  talkingPoints: [
    'What does your order-to-fulfillment flow look like today, end to end?',
    'Which manual task costs you the most hours per week?',
    'What would a successful launch look like 90 days from now?',
    'How do you currently follow up with abandoned carts?',
  ],
  risks: [
    'Single-channel dependency on one decision maker',
    'Legacy content migration may add scope',
    'No stated maintenance budget yet',
  ],
  recommendedPlan:
    'Phase 1: discovery audit and scope lock. Phase 2: storefront rebuild with payments. Phase 3: automation integration and team handover. First milestone: audit + wireframes.',
  priorityScore: 62,
  followUpRecommendation:
    'Follow up by email within 2 business days with a short audit offer; call in week 2 if no reply.',
  confidenceNote:
    'Moderate confidence — grounded in the CRM record and engagement signals; industry context is inferred, not verified.',
}

const content = JSON.stringify({
  executionId: 'demo-planted-2026-09-17',
  generatedAt: new Date().toISOString(),
  dossier,
})

const existing = await db.aiMemory.findFirst({
  where: { scope: 'CLIENT', key: 'AI_RESEARCH_DOSSIER', clientId: client.id },
})
if (existing) {
  await db.aiMemory.update({
    where: { id: existing.id },
    data: { content, agentCode: 'CRM-003', importance: 8, updatedAt: new Date() },
  })
} else {
  await db.aiMemory.create({
    data: { scope: 'CLIENT', key: 'AI_RESEARCH_DOSSIER', content, clientId: client.id, agentCode: 'CRM-003', importance: 8 },
  })
}

const check = await db.aiMemory.findFirst({
  where: { scope: 'CLIENT', key: 'AI_RESEARCH_DOSSIER', clientId: client.id },
})
console.log('planted:', check?.id, '| agentCode:', check?.agentCode, '| importance:', check?.importance)
console.log('content length:', check?.content.length)
await db.$disconnect()
