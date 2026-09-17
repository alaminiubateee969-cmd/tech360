import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  // plant two legacy rows (one duplicate email to test skip logic)
  await db.formSubmission.create({ data: { form: 'NEWSLETTER', name: 'Newsletter Subscriber', email: 'legacy.one@example.com', status: 'PROCESSED', createdAt: new Date('2026-08-25T10:00:00Z') } })
  await db.formSubmission.create({ data: { form: 'NEWSLETTER', name: 'Newsletter Subscriber', email: 'legacy.two@example.com', status: 'PROCESSED', createdAt: new Date('2026-09-01T10:00:00Z') } })
  await db.newsletterSubscriber.create({ data: { email: 'legacy.two@example.com', source: 'FOOTER', createdAt: new Date('2026-09-05T10:00:00Z') } })
  console.log('planted: 2 legacy form rows + 1 existing subscriber for legacy.two (duplicate test)')
}
main().finally(() => db.$disconnect())
