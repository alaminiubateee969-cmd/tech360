import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  // ---------- CLEANUP test artifacts ----------
  const testEmail = 'curl.test+probe@example.com'
  const subs = await db.newsletterSubscriber.deleteMany({ where: { email: testEmail } })
  const forms = await db.formSubmission.deleteMany({ where: { form: 'NEWSLETTER', email: testEmail } })
  const trk = await db.trackingEvent.deleteMany({ where: { OR: [{ path: '/newsletter' }, { path: '/newsletter/unsubscribe' }] } })
  const camp = await db.emailCampaign.deleteMany({ where: { id: 'cmu550fw30000so7967do99eo' } })
  console.log(`cleanup: subs=${subs.count} forms=${forms.count} tracking=${trk.count} throwawayCampaign=${camp.count}`)

  // ---------- DEMO DATA (one honest AI-drafted campaign; subscribers stay empty) ----------
  const body = [
    '<p>This quarter we shipped the things we said we would ship, and a few we only decided to build halfway through. The through-line was the same one we keep repeating to ourselves: a client should be able to see, verify and pay for real work — never promises.</p>',
    '<p>The live chat widget on our platform now carries real conversations end to end. A visitor types, the message lands in the admin console with full context, and a human picks it up with the entire history attached. No copy-paste between tools, no "let me find your file." The conversation is the record.</p>',
    '<p>The client portal matured into the place where delivery actually happens: milestone payments with verifiable status, project build progress, previews with expiry, documents flowing both ways with scanning on every upload, and meeting scheduling that prepares its own agenda. The payments pipeline behind it now settles through webhook-verified checkout — the platform never marks anything paid until a signature-checked event says so.</p>',
    '<p>And the AI agents earned their keep. Forty-plus registered agents executed real work this quarter — drafting scopes, scoring leads, preparing meeting agendas, writing these very drafts — with every execution logged, auditable and reversible by a human. That is the takeaway we want to leave you with: automation you can inspect is the only automation worth trusting. If your business runs on software nobody can audit, it runs on hope.</p>',
  ].join('\n')

  const existing = await db.emailCampaign.findFirst({ where: { agentExecId: 'demo-draft-execution-2026-09-17' } })
  if (existing) {
    console.log('demo campaign already present:', existing.id, existing.name)
    return
  }
  const c = await db.emailCampaign.create({
    data: {
      name: 'Q3 Engineering Insights — What we shipped',
      subject: 'Q3 at TECH360: what we shipped and what we learned',
      body,
      status: 'DRAFT',
      agentExecId: 'demo-draft-execution-2026-09-17',
    },
  })
  console.log('DEMO_CAMPAIGN=' + c.id, c.name, '| bodyChars:', body.length)

  const final = await db.emailCampaign.findMany({ select: { id: true, name: true, status: true, agentExecId: true } })
  console.log('campaigns in DB:', JSON.stringify(final))
  console.log('subscribers in DB (must be 0):', await db.newsletterSubscriber.count())
}

main().finally(() => db.$disconnect())
