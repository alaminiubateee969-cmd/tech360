import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const logs = await db.auditLog.findMany({
    where: { action: { in: ['LEADS_EXPORTED', 'NEWSLETTER_CAMPAIGN_UPDATED', 'NEWSLETTER_DRAFTED', 'NEWSLETTER_SENT'] } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { action: true, actor: true, details: true, createdAt: true },
  })
  for (const l of logs) console.log(l.createdAt.toISOString(), l.action, '·', l.actor, '·', (l.details ?? '').slice(0, 110))
  const errs = await db.errorLog.findMany({ where: { source: 'AGENT', workflow: 'NEWSLETTER_DRAFT' }, orderBy: { createdAt: 'desc' }, take: 3, select: { code: true, message: true, createdAt: true } })
  for (const e of errs) console.log('ERRORLOG', e.createdAt.toISOString(), e.code, e.message.slice(0, 130))
}
main().finally(() => db.$disconnect())
