import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const project = await db.project.findFirst({ where: { code: 'PRJ-2026-0001' }, include: { client: true, payments: true } })
if (!project) { console.log('NO PROJECT'); process.exit(0) }
const count = await db.invoice.count()
const number = `INV-2026-${String(count + 1).padStart(4, '0')}`
const inv = await db.invoice.create({
  data: {
    number, clientId: project.clientId, projectId: project.id,
    amount: 1250, currency: 'USD', status: 'PAID',
    notes: 'Milestone 1 — Platform build & deployment', issuedAt: project.startedAt ?? new Date(),
  },
})
console.log(JSON.stringify({ number: inv.number, status: inv.status, client: project.client.clientId, project: project.code }))
await db.$disconnect()
