/**
 * E2E harness seed (SQLite throwaway database — see scripts/e2e-sqlite.mjs).
 *
 * Seeds ONLY what the end-to-end flows need to prove real persistence:
 * a Super Admin, one client with portal access, one AI agent with a real
 * execution record (feeds the portal "AI team at work" card), and one
 * published blog post. Real production data is never touched — this runs
 * against the throwaway SQLite file only.
 */
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const db = new PrismaClient()

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'super.admin@e2e.tech360.internal'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'E2e-Root-2026!'
const CLIENT_ID = 'TECH-2026-000001'
const CLIENT_EMAIL = 'rahim@dhakaroasters.example'

async function main() {
  const existing = await db.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existing) {
    console.log(JSON.stringify({ seeded: false, reason: 'already seeded' }))
    return
  }

  const user = await db.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: 'E2E Super Admin',
      role: 'SUPER_ADMIN',
      passwordHash: hashPassword(ADMIN_PASSWORD),
      isActive: true,
    },
  })

  const client = await db.client.create({
    data: {
      clientId: CLIENT_ID,
      name: 'Rahim Uddin',
      businessName: 'Dhaka Coffee Roasters',
      businessType: 'ECOMMERCE',
      email: CLIENT_EMAIL,
      source: 'WEBSITE',
      status: 'CLIENT',
      pipelineStage: 'SCOPE_REVIEW',
    },
  })

  // One real registry agent + one real execution record, linked to the client
  const agent = await db.aiAgent.create({
    data: {
      code: 'CEO-001',
      name: 'Atlas',
      title: 'CEO Command Agent',
      purpose: 'Orchestrates company operations, monitors KPIs, prepares CEO reports, coordinates agents.',
      systemPrompt: 'You are Atlas, CEO Command Agent of Tech360.',
      tools: JSON.stringify(['crm.query', 'report.generate', 'agent.dispatch']),
      permissions: JSON.stringify(['read:all', 'report:all']),
    },
  })

  const execution = await db.aiAgentExecution.create({
    data: {
      agentCode: agent.code,
      correlationId: 'e2e-seed-execution-001',
      clientId: client.id,
      workflow: 'CLIENT_RESEARCH',
      input: JSON.stringify({ clientId: client.clientId, task: 'compile client account summary' }),
      output: JSON.stringify({ summary: 'E2E seeded execution record', sections: 3 }),
      status: 'SUCCESS',
      tokensUsed: 0,
      durationMs: 4200,
      startedAt: new Date(Date.now() - 60_000),
      completedAt: new Date(Date.now() - 55_800),
    },
  })

  const post = await db.blogPost.create({
    data: {
      slug: 'e2e-verification-post',
      title: 'E2E verification post',
      excerpt: 'Proves the public blog API reads real database rows.',
      content: '<p>This post exists only in the throwaway E2E database. It proves /api/blog serves persisted rows.</p>',
      category: 'Engineering',
      status: 'PUBLISHED',
      author: 'Tech360 Team',
    },
  })

  console.log(JSON.stringify({
    seeded: true,
    userId: user.id,
    clientId: client.id,
    agentCode: agent.code,
    executionId: execution.id,
    blogPostId: post.id,
  }))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
