/**
 * TECH360 — demo dataset for the offline preview database (development only).
 *
 * Loads a realistic slice of the production pipeline so the website, the client
 * portal and the Super Admin console can be reviewed without MySQL:
 * staff logins, leads across every pipeline stage, active projects with agent
 * tasks, scopes, invoices with payments, meetings, communications, the visitor
 * inbox, newsletter, growth and governance records.
 *
 * Every record is clearly fictional. Idempotent: re-running only fills gaps.
 */
import { db } from '../../src/lib/db'
import { hashPassword } from '../../src/lib/auth'

const day = 86_400_000
const ago = (d: number) => new Date(Date.now() - d * day)
const ahead = (d: number) => new Date(Date.now() + d * day)

async function user(email: string, name: string, role: string, title: string, password: string) {
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return existing
  return db.user.create({
    data: { email, name, role, title, passwordHash: hashPassword(password), isActive: true },
  })
}

type ClientSeed = {
  clientId: string
  name: string
  businessName: string
  businessType: string
  email: string
  phone: string
  whatsapp: string
  country: string
  source: string
  status: string
  pipelineStage: string
  score: number
  notes?: string
  lead?: { requirements: string; budgetRange: string; projectType: string; interest: string }
}

const CLIENTS: ClientSeed[] = [
  {
    clientId: 'TECH-2026-000101',
    name: 'Rahim Uddin',
    businessName: 'Dhaka Coffee Roasters',
    businessType: 'ECOMMERCE',
    email: 'rahim@dhakaroasters.example',
    phone: '+8801711000101',
    whatsapp: '+8801711000101',
    country: 'Bangladesh',
    source: 'WEBSITE',
    status: 'ACTIVE',
    pipelineStage: 'PROJECT_ACTIVE',
    score: 92,
    notes: 'Repeat buyer. Wants warehouse + courier integration in phase two.',
    lead: {
      requirements: 'Storefront with bKash/SSLCommerz checkout, 400 SKUs, courier API, loyalty points.',
      budgetRange: 'USD 4,000 – 6,000',
      projectType: 'eCommerce',
      interest: 'Subscription coffee boxes',
    },
  },
  {
    clientId: 'TECH-2026-000102',
    name: 'Sarah Mitchell',
    businessName: 'Mitchell Legal Advisors',
    businessType: 'PROFESSIONAL_SERVICES',
    email: 'sarah@mitchelllegal.example',
    phone: '+14155550142',
    whatsapp: '+14155550142',
    country: 'United States',
    source: 'WHATSAPP',
    status: 'CLIENT',
    pipelineStage: 'SCOPE_REVIEW',
    score: 78,
    notes: 'Needs HIPAA-grade document handling; legal review of the SOW in progress.',
    lead: {
      requirements: 'Client intake portal, document vault, appointment booking, e-signature.',
      budgetRange: 'USD 8,000 – 12,000',
      projectType: 'Custom CRM',
      interest: 'Case management automation',
    },
  },
  {
    clientId: 'TECH-2026-000103',
    name: 'Imran Hossain',
    businessName: 'Chittagong Steel Works',
    businessType: 'MANUFACTURING',
    email: 'imran@ctgsteel.example',
    phone: '+8801811000103',
    whatsapp: '+8801811000103',
    country: 'Bangladesh',
    source: 'REFERRAL',
    status: 'CLIENT',
    pipelineStage: 'PAYMENT_PENDING',
    score: 85,
    notes: 'Advance invoice issued. Production scheduling dashboard scoped.',
    lead: {
      requirements: 'Production scheduling dashboard, inventory, dealer order portal.',
      budgetRange: 'USD 10,000 – 15,000',
      projectType: 'Business dashboard',
      interest: 'Factory automation',
    },
  },
  {
    clientId: 'TECH-2026-000104',
    name: 'Ayesha Karim',
    businessName: 'Karim Fashion House',
    businessType: 'RETAIL',
    email: 'ayesha@karimfashion.example',
    phone: '+8801911000104',
    whatsapp: '+8801911000104',
    country: 'Bangladesh',
    source: 'INSTAGRAM',
    status: 'LEAD',
    pipelineStage: 'QUALIFIED',
    score: 64,
    notes: 'Instagram DM lead. Asked for a catalogue site with WhatsApp ordering.',
    lead: {
      requirements: 'Catalogue website, WhatsApp order flow, seasonal collections.',
      budgetRange: 'BDT 150,000 – 250,000',
      projectType: 'Website',
      interest: 'Online catalogue',
    },
  },
  {
    clientId: 'TECH-2026-000105',
    name: 'Daniel Okafor',
    businessName: 'Lagos Logistics Co.',
    businessType: 'LOGISTICS',
    email: 'daniel@lagoslogistics.example',
    phone: '+2348011000105',
    whatsapp: '+2348011000105',
    country: 'Nigeria',
    source: 'LINKEDIN',
    status: 'LEAD',
    pipelineStage: 'NEW',
    score: 41,
    notes: 'Inbound LinkedIn message about fleet tracking.',
    lead: {
      requirements: 'Fleet tracking dashboard with driver mobile app.',
      budgetRange: 'USD 6,000 – 9,000',
      projectType: 'Web application',
      interest: 'Fleet operations',
    },
  },
  {
    clientId: 'TECH-2026-000106',
    name: 'Nusrat Jahan',
    businessName: 'Jahan Dental Clinic',
    businessType: 'HEALTHCARE',
    email: 'nusrat@jahandental.example',
    phone: '+8801611000106',
    whatsapp: '+8801611000106',
    country: 'Bangladesh',
    source: 'EMAIL',
    status: 'COMPLETED',
    pipelineStage: 'DELIVERED',
    score: 88,
    notes: 'Site delivered and handed over. Ideal referral candidate.',
    lead: {
      requirements: 'Clinic site, appointment booking, treatment pages, local SEO.',
      budgetRange: 'USD 2,000 – 3,000',
      projectType: 'Website',
      interest: 'Patient acquisition',
    },
  },
]

async function main() {
  const superAdmin = await user(
    'admin@tech360.local',
    'Tech360 Super Admin',
    'SUPER_ADMIN',
    'Platform Owner',
    'Tech360-Demo-2026!',
  )
  await user('operations@tech360.local', 'Tech360 Operations Admin', 'ADMIN', 'Operations Administrator', 'Tech360-Demo-2026!')
  await user('manager@tech360.local', 'Farhana Rahman', 'MANAGER', 'Delivery Manager', 'Tech360-Demo-2026!')
  await user('sales@tech360.local', 'Tanvir Ahmed', 'STAFF', 'Growth Specialist', 'Tech360-Demo-2026!')

  const clientRows: Record<string, { id: string; clientId: string; name: string }> = {}

  for (const c of CLIENTS) {
    let row = await db.client.findUnique({ where: { clientId: c.clientId } })
    if (!row) {
      row = await db.client.create({
        data: {
          clientId: c.clientId,
          name: c.name,
          businessName: c.businessName,
          businessType: c.businessType,
          email: c.email,
          phone: c.phone,
          whatsapp: c.whatsapp,
          country: c.country,
          source: c.source,
          status: c.status,
          pipelineStage: c.pipelineStage,
          score: c.score,
          preferredContact: c.source === 'EMAIL' ? 'EMAIL' : 'WHATSAPP',
          notes: c.notes ?? null,
        },
      })
    }
    clientRows[c.clientId] = { id: row.id, clientId: row.clientId, name: row.name }

    if (c.lead && !(await db.lead.findUnique({ where: { clientId: row.id } }))) {
      await db.lead.create({
        data: {
          clientId: row.id,
          requirements: c.lead.requirements,
          budgetRange: c.lead.budgetRange,
          projectType: c.lead.projectType,
          interest: c.lead.interest,
          tracking: JSON.stringify({ utm_source: c.source.toLowerCase(), anonId: `demo-${c.clientId}` }),
          contactedAt: ago(9),
          qualifiedAt: c.pipelineStage === 'NEW' ? null : ago(8),
        },
      })
    }
  }

  const rahim = clientRows['TECH-2026-000101']
  const sarah = clientRows['TECH-2026-000102']
  const imran = clientRows['TECH-2026-000103']
  const nusrat = clientRows['TECH-2026-000106']

  // ---------------- scopes ----------------
  if ((await db.scopeOfWork.count()) === 0) {
    await db.scopeOfWork.create({
      data: {
        clientId: sarah.id,
        version: 2,
        status: 'AWAITING_ADMIN_APPROVAL',
        summary: 'Client intake portal + document vault + booking + e-signature (12 week programme).',
        content: JSON.stringify({
          items: [
            'Client intake portal with secure login',
            'Document vault with audit trail',
            'Appointment booking with calendar sync',
            'E-signature workflow on engagement letters',
          ],
          timeline: '12 weeks (4 phases)',
          paymentPolicy: '40% advance / 30% milestone / 30% delivery',
          deliverables: ['Source code', 'Admin console', 'Deployment runbook', '30-day support'],
        }),
        aiNotes: 'Scope reviewed by SCOPE-014: recommend adding data-retention clause and a DPA appendix.',
        generatedBy: 'SCOPE-014',
      },
    })
  }

  // ---------------- projects + tasks ----------------
  type ProjectSeed = {
    code: string
    client: { id: string }
    name: string
    description: string
    plan: string
    status: string
    total: number
    paid: number
    paymentStatus: string
    weeks: number
    startedAt: Date
  }
  const PROJECTS: ProjectSeed[] = [
    {
      code: 'PRJ-2026-0101',
      client: rahim,
      name: 'Dhaka Coffee Roasters — Storefront & Loyalty',
      description: 'Headless storefront, bKash + SSLCommerz, courier API, loyalty tiers.',
      plan: 'GROWTH',
      status: 'ACTIVE',
      total: 5200,
      paid: 2080,
      paymentStatus: 'PARTIAL',
      weeks: 10,
      startedAt: ago(24),
    },
    {
      code: 'PRJ-2026-0102',
      client: imran,
      name: 'Chittagong Steel — Production Dashboard',
      description: 'Production scheduling, inventory reconciliation and dealer order portal.',
      plan: 'ENTERPRISE',
      status: 'PLANNING',
      total: 12500,
      paid: 0,
      paymentStatus: 'PENDING',
      weeks: 16,
      startedAt: ago(2),
    },
    {
      code: 'PRJ-2026-0103',
      client: nusrat,
      name: 'Jahan Dental — Clinic Website & Booking',
      description: 'Clinic website, treatment pages, booking, local SEO foundation.',
      plan: 'STARTER',
      status: 'COMPLETED',
      total: 2400,
      paid: 2400,
      paymentStatus: 'PAID',
      weeks: 4,
      startedAt: ago(62),
    },
  ]

  for (const p of PROJECTS) {
    const exists = await db.project.findUnique({ where: { code: p.code } })
    if (exists) continue
    const project = await db.project.create({
      data: {
        code: p.code,
        clientId: p.client.id,
        name: p.name,
        description: p.description,
        plan: p.plan,
        status: p.status,
        currency: 'USD',
        totalAmount: p.total,
        paidAmount: p.paid,
        paymentStatus: p.paymentStatus,
        timelineWeeks: p.weeks,
        startedAt: p.startedAt,
        deliveredAt: p.status === 'COMPLETED' ? ago(8) : null,
        closedAt: p.status === 'COMPLETED' ? ago(6) : null,
      },
    })

    const taskTitles: Array<[string, string, string, string]> = [
      ['Discovery & requirements sign-off', 'DONE', 'HIGH', 'SCOPE-014'],
      ['Information architecture & wireframes', 'DONE', 'MEDIUM', 'DSGN-021'],
      ['Design system + UI screens', p.status === 'COMPLETED' ? 'DONE' : 'IN_PROGRESS', 'HIGH', 'DSGN-021'],
      ['Application build (frontend)', p.status === 'COMPLETED' ? 'DONE' : 'IN_PROGRESS', 'HIGH', 'BLD-008'],
      ['Application build (API + database)', p.status === 'COMPLETED' ? 'DONE' : 'TODO', 'HIGH', 'BLD-008'],
      ['Payment gateway integration', p.status === 'COMPLETED' ? 'DONE' : 'TODO', 'MEDIUM', 'BLD-008'],
      ['QA regression suite', p.status === 'COMPLETED' ? 'DONE' : 'REVIEW', 'MEDIUM', 'QA-011'],
      ['Client review & UAT', p.status === 'COMPLETED' ? 'DONE' : 'TODO', 'MEDIUM', 'OPS-003'],
      ['Deployment & handover package', p.status === 'COMPLETED' ? 'DONE' : 'TODO', 'HIGH', 'OPS-003'],
    ]
    await db.projectTask.createMany({
      data: taskTitles.map(([title, status, priority, ref], i) => ({
        projectId: project.id,
        title,
        status,
        priority,
        assigneeType: 'AGENT',
        assigneeRef: ref,
        order: i,
        dueAt: ahead(7 + i * 3),
        completedAt: status === 'DONE' ? ago(10 + i) : null,
      })),
    })

    if (p.status === 'COMPLETED') {
      await db.delivery.create({
        data: {
          clientId: p.client.id,
          projectId: project.id,
          status: 'CONFIRMED',
          checklist: JSON.stringify({
            scope: true,
            files: true,
            docs: true,
            deployment: true,
            credentials: true,
            testing: true,
          }),
          deliveredAt: ago(9),
          clientConfirmedAt: ago(8),
          confirmationAnswers: JSON.stringify({ accepted: true, notes: 'Signed off by Dr. Nusrat Jahan.' }),
        },
      })
      await db.handoverRecord.create({
        data: {
          clientId: p.client.id,
          projectId: project.id,
          status: 'CONFIRMED',
          packageToken: `demo-handover-${project.code}`,
          expiryAt: ahead(21),
          releasedAt: ago(8),
          downloadedAt: ago(7),
          confirmedAt: ago(7),
          contents: JSON.stringify({ source: true, docs: true, credentials: true }),
        } as never,
      })
    }
  }

  // ---------------- invoices + payments ----------------
  const projectRows = await db.project.findMany({ select: { id: true, code: true, clientId: true } }) as Array<{ id: string; code: string; clientId: string }>
  const projByCode = new Map(projectRows.map((p) => [p.code, p]))
  if ((await db.invoice.count()) === 0) {
    const coffee = projByCode.get('PRJ-2026-0101')!
    const steel = projByCode.get('PRJ-2026-0102')!
    const dental = projByCode.get('PRJ-2026-0103')!

    const inv1 = await db.invoice.create({
      data: {
        number: 'INV-2026-0101',
        clientId: coffee.clientId,
        projectId: coffee.id,
        currency: 'USD',
        amount: 2080,
        subtotalMinor: 208000,
        totalMinor: 208000,
        description: 'Advance payment — 40% of storefront programme',
        status: 'PAID',
        issuedAt: ago(23),
        dueAt: ago(18),
        paidAt: ago(20),
        billingName: 'Rahim Uddin',
        billingBusiness: 'Dhaka Coffee Roasters',
        billingEmail: 'rahim@dhakaroasters.example',
        billingCountry: 'Bangladesh',
        paymentTerms: 'Due within 5 days of issue.',
        termsVersion: '2026-01',
      },
    })
    await db.payment.create({
      data: {
        clientId: coffee.clientId,
        projectId: coffee.id,
        invoiceId: inv1.id,
        milestone: 'ADVANCE',
        amount: 2080,
        currency: 'USD',
        method: 'BKASH',
        transactionId: 'BKSH-DEMO-88421',
        status: 'PAID',
        verifiedBy: superAdmin.id,
        verifiedAt: ago(20),
        notes: 'Verified against bKash merchant statement (demo).',
      },
    })

    const inv2 = await db.invoice.create({
      data: {
        number: 'INV-2026-0102',
        clientId: steel.clientId,
        projectId: steel.id,
        currency: 'USD',
        amount: 5000,
        subtotalMinor: 500000,
        totalMinor: 500000,
        description: 'Advance payment — production dashboard programme',
        status: 'ISSUED',
        issuedAt: ago(2),
        dueAt: ahead(3),
        billingName: 'Imran Hossain',
        billingBusiness: 'Chittagong Steel Works',
        billingEmail: 'imran@ctgsteel.example',
        billingCountry: 'Bangladesh',
        paymentTerms: '40% advance, 30% at milestone, 30% at delivery.',
        termsVersion: '2026-01',
      },
    })
    await db.payment.create({
      data: {
        clientId: steel.clientId,
        projectId: steel.id,
        invoiceId: inv2.id,
        milestone: 'ADVANCE',
        amount: 5000,
        currency: 'USD',
        method: 'BANK_TRANSFER',
        status: 'PENDING',
        notes: 'Awaiting bank confirmation (demo).',
      },
    })

    const inv3 = await db.invoice.create({
      data: {
        number: 'INV-2026-0103',
        clientId: dental.clientId,
        projectId: dental.id,
        currency: 'USD',
        amount: 2400,
        subtotalMinor: 240000,
        totalMinor: 240000,
        description: 'Clinic website — final settlement',
        status: 'PAID',
        issuedAt: ago(60),
        dueAt: ago(55),
        paidAt: ago(58),
        billingName: 'Nusrat Jahan',
        billingBusiness: 'Jahan Dental Clinic',
        billingEmail: 'nusrat@jahandental.example',
        billingCountry: 'Bangladesh',
        termsVersion: '2026-01',
      },
    })
    await db.payment.create({
      data: {
        clientId: dental.clientId,
        projectId: dental.id,
        invoiceId: inv3.id,
        milestone: 'FINAL',
        amount: 2400,
        currency: 'USD',
        method: 'CARD',
        transactionId: 'pi_demo_3f19x',
        status: 'PAID',
        verifiedBy: superAdmin.id,
        verifiedAt: ago(58),
      },
    })
  }

  // ---------------- meetings ----------------
  if ((await db.meeting.count()) === 0) {
    await db.meeting.createMany({
      data: [
        {
          clientId: sarah.id,
          reason: 'Scope walkthrough before final SOW approval.',
          status: 'SCHEDULED',
          channel: 'GOOGLE_MEET',
          scheduledAt: ahead(1),
          bookingLink: 'https://meet.example.com/tech360-scope-sarah',
        },
        {
          clientId: imran.id,
          reason: 'Production dashboard kick-off call.',
          status: 'REQUESTED',
          channel: 'ZOOM',
          scheduledAt: ahead(3),
        },
        {
          clientId: rahim.id,
          reason: 'Weekly build review.',
          status: 'COMPLETED',
          channel: 'GOOGLE_MEET',
          scheduledAt: ago(4),
          notes: 'Checkout flow approved; courier API waiting on credentials.',
        },
      ],
    })
  }

  // ---------------- communications ----------------
  if ((await db.communication.count()) === 0) {
    const comms = [
      ['EMAIL', 'OUT', 'Welcome to Tech360 — your Client ID TECH-2026-000101', 'rahim@dhakaroasters.example', 'SENT'],
      ['WHATSAPP', 'IN', 'Can we add a subscription box next month?', '+8801711000101', 'RECEIVED'],
      ['WHATSAPP', 'OUT', 'Advance invoice INV-2026-0101 issued — 40% to start build.', '+8801711000101', 'DELIVERED'],
      ['EMAIL', 'OUT', 'Scope v2 attached for your review (12-week programme).', 'sarah@mitchelllegal.example', 'SENT'],
      ['SMS', 'OUT', 'Invoice INV-2026-0102 due in 3 days.', '+8801811000103', 'SENT'],
      ['PORTAL', 'OUT', 'Preview link shared for client review.', 'nusrat@jahandental.example', 'DELIVERED'],
      ['EMAIL', 'IN', 'Re: scope — legal needs a DPA appendix.', 'sarah@mitchelllegal.example', 'RECEIVED'],
      ['WEB', 'IN', 'Do you build on Shopify or custom stacks?', 'daniel@lagoslogistics.example', 'RECEIVED'],
    ] as const
    for (const [channel, direction, subject, recipient, status] of comms) {
      await db.communication.create({
        data: {
          clientId: null,
          channel,
          direction,
          recipient,
          subject,
          body:
            direction === 'OUT'
              ? `${subject}\n\nThis is a demo message stored by the Tech360 communication pipeline. Channel credentials are NOT_CONFIGURED in this preview, so nothing is sent externally.`
              : `${subject}\n\nDemo inbound message recorded from the channel webhook.`,
          status,
          createdAt: ago(Math.floor(Math.random() * 20) + 1),
          sentAt: direction === 'OUT' ? ago(2) : null,
        },
      })
    }
  }

  // ---------------- visitor chat inbox ----------------
  if ((await db.chatConversation.count()) === 0) {
    const conv = await db.chatConversation.create({
      data: {
        anonId: 'demo-sarah-mitchell',
        status: 'OPEN',
        visitorName: 'Sarah Mitchell',
        visitorEmail: 'sarah@mitchelllegal.example',
        subject: 'Intake portal for a law firm',
        lastMessagePreview: 'Can you share the SOW with a DPA appendix?',
        lastSender: 'VISITOR',
        unreadCount: 2,
        createdAt: ago(1),
        messages: {
          create: [
            { sender: 'VISITOR', body: 'Hi — we need a client intake portal with a document vault.', createdAt: ago(1) },
            { sender: 'SYSTEM', body: 'Scope agent SCOPE-014 captured requirements and created Client ID TECH-2026-000102.', createdAt: ago(1) },
            { sender: 'VISITOR', body: 'Can you share the SOW with a DPA appendix?', createdAt: ago(0) },
          ],
        },
      },
    })
    await db.chatConversation.create({
      data: {
        anonId: 'demo-ayesha',
        status: 'CLOSED',
        visitorName: 'Ayesha Karim',
        visitorEmail: 'ayesha@karimfashion.example',
        subject: 'Catalogue site with WhatsApp ordering',
        lastMessagePreview: 'Thanks — talking to my partner, will revert.',
        lastSender: 'VISITOR',
        unreadCount: 0,
        createdAt: ago(6),
        messages: {
          create: [
            { sender: 'VISITOR', body: 'I want a catalogue with WhatsApp ordering.', createdAt: ago(6) },
            { sender: 'ADMIN', body: 'Happy to help — here is a starter scope.', createdAt: ago(6) },
            { sender: 'VISITOR', body: 'Thanks — talking to my partner, will revert.', createdAt: ago(5) },
          ],
        },
      },
    })
    void conv
  }

  // ---------------- newsletter + campaign ----------------
  if ((await db.newsletterSubscriber.count()) === 0) {
    await db.newsletterSubscriber.createMany({
      data: [
        { email: 'rahim@dhakaroasters.example', name: 'Rahim Uddin', source: 'FOOTER', consentAt: ago(30) },
        { email: 'sarah@mitchelllegal.example', name: 'Sarah Mitchell', source: 'BLOG', consentAt: ago(22) },
        { email: 'imran@ctgsteel.example', name: 'Imran Hossain', source: 'CONTACT_FORM', consentAt: ago(15) },
        { email: 'ayesha@karimfashion.example', name: 'Ayesha Karim', source: 'FOOTER', consentAt: ago(9) },
        { email: 'old.subscriber@example.com', name: 'Left Already', source: 'FOOTER', status: 'UNSUBSCRIBED', consentAt: ago(90), unsubscribedAt: ago(40) },
      ],
    })
  }
  if ((await db.emailCampaign.count()) === 0) {
    await db.emailCampaign.create({
      data: {
        name: 'October — Automation playbook',
        subject: 'How Bangladeshi SMBs cut order handling time by 60%',
        body: 'Hi {{name}},\n\nThis month we published the automation playbook we use on every storefront build...\n',
        status: 'DRAFT',
        createdBy: superAdmin.id,
      },
    })
  }

  // ---------------- knowledge base ----------------
  if ((await db.knowledgeDocument.count()) === 0) {
    await db.knowledgeDocument.createMany({
      data: [
        {
          title: 'Tech360 Master Service Agreement (template)',
          filename: 'msa-template.txt',
          mimeType: 'text/plain',
          size: 1820,
          classification: 'PRIVATE',
          status: 'INDEXED',
          extractedText: 'Master Service Agreement between Tech360 LLC and the Client...',
          uploadedBy: superAdmin.id,
        },
        {
          title: 'Payment policy & refund rules',
          filename: 'payment-policy.txt',
          mimeType: 'text/plain',
          size: 940,
          classification: 'PUBLIC',
          status: 'APPROVED',
          extractedText: 'Advance / milestone / final split, refund eligibility, settlement rules...',
          uploadedBy: superAdmin.id,
        },
      ],
    })
  }

  // ---------------- growth ----------------
  if ((await db.review.count()) === 0) {
    await db.review.create({
      data: {
        clientId: nusrat.id,
        projectId: projByCode.get('PRJ-2026-0103')?.id ?? null,
        rating: 5,
        content: 'Delivered on time, booking flow works perfectly and the handover pack was complete.',
        status: 'APPROVED',
        published: true,
        consent: true,
        moderatedBy: superAdmin.id,
        moderatedAt: ago(6),
      },
    })
    await db.review.create({
      data: {
        clientId: rahim.id,
        rating: 4,
        content: 'Strong build quality; wanted the courier integration sooner.',
        status: 'PENDING',
        published: false,
        consent: true,
      },
    })
  }
  if ((await db.referral.count()) === 0) {
    await db.referral.create({
      data: {
        clientId: nusrat.id,
        name: 'Dr. Sabrina Chowdhury',
        contact: '+8801711000199',
        notes: 'Referred a second clinic in Dhanmondi.',
        status: 'RECEIVED',
      },
    })
  }
  if ((await db.campaign.count()) === 0) {
    await db.campaign.create({
      data: {
        name: 'Q4 2026 — "Automate or stall"',
        goal: 'Generate 40 qualified SMB leads from short-form video.',
        channel: 'LINKEDIN',
        audience: 'Bangladeshi SMB owners, 25–45, retail + services',
        status: 'SCRIPTING',
        hooks: JSON.stringify(['60% less order admin', 'One dashboard, every channel']),
        metrics: JSON.stringify({}) as never,
        lessons: JSON.stringify([]) as never,
      },
    })
  }

  // ---------------- governance ----------------
  if ((await db.approvalRequest.count()) === 0) {
    await db.approvalRequest.createMany({
      data: [
        {
          type: 'FINAL_SCOPE_SEND',
          title: 'Send final SOW v2 to Sarah Mitchell',
          description: 'Scope agent prepared SOW v2 with the DPA appendix requested by the client.',
          clientId: sarah.id,
          agentCode: 'SCOPE-014',
          payload: JSON.stringify({ channel: 'EMAIL', recipient: 'sarah@mitchelllegal.example', risk: 'MEDIUM' }),
          risk: 'MEDIUM',
          status: 'PENDING',
          requestedBy: 'SCOPE-014',
        },
        {
          type: 'REFUND',
          title: 'Refund request — duplicate bank transfer',
          description: 'Client transferred the advance twice; second transfer needs a refund decision.',
          clientId: imran.id,
          agentCode: 'FIN-007',
          payload: JSON.stringify({ amount: 5000, currency: 'USD', method: 'BANK_TRANSFER' }),
          risk: 'HIGH',
          status: 'PENDING',
          requestedBy: 'FIN-007',
        },
        {
          type: 'SOURCE_HANDOVER',
          title: 'Source handover — Jahan Dental',
          description: 'Final payment settled; handover package ready for release.',
          clientId: nusrat.id,
          agentCode: 'OPS-003',
          payload: JSON.stringify({ projectCode: 'PRJ-2026-0103' }),
          risk: 'HIGH',
          status: 'APPROVED',
          requestedBy: 'OPS-003',
          decidedBy: superAdmin.id,
          decisionNote: 'Payment confirmed. Release approved.',
          executedAt: ago(7),
        },
      ],
    })
  }

  if ((await db.callLog.count()) === 0) {
    await db.callLog.createMany({
      data: [
        { clientId: imran.id, direction: 'OUTBOUND', number: '+8801811000103', channel: 'CLICK_TO_CALL', status: 'COMPLETED', outcome: 'Advance payment explained', durationSec: 412, endedAt: ago(3) },
        { clientId: sarah.id, direction: 'INBOUND', number: '+14155550142', channel: 'DEVICE_GATEWAY', status: 'MISSED', outcome: 'Call back tomorrow', durationSec: 0, endedAt: ago(1) },
      ],
    })
  }

  if ((await db.notification.count()) === 0) {
    await db.notification.createMany({
      data: [
        { type: 'LEAD', title: 'New lead from LinkedIn', body: 'Daniel Okafor — Lagos Logistics Co. asked about fleet tracking.', severity: 'INFO', link: '#/admin' },
        { type: 'PAYMENT', title: 'Advance invoice issued', body: 'INV-2026-0102 for Chittagong Steel Works (USD 5,000).', severity: 'WARNING', link: '#/admin' },
        { type: 'APPROVAL', title: 'Approval waiting', body: 'Final SOW v2 for Sarah Mitchell needs your decision.', severity: 'WARNING', link: '#/admin' },
      ],
    })
  }

  const counts = {
    clients: await db.client.count(),
    leads: await db.lead.count(),
    projects: await db.project.count(),
    tasks: await db.projectTask.count(),
    invoices: await db.invoice.count(),
    payments: await db.payment.count(),
    approvals: await db.approvalRequest.count(),
    agents: await db.aiAgent.count(),
  }
  console.log('demo dataset ready:', JSON.stringify(counts))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
