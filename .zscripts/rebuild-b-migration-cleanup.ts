import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const forms = await db.formSubmission.deleteMany({ where: { form: 'NEWSLETTER', email: { in: ['legacy.one@example.com', 'legacy.two@example.com'] } } })
  const subs = await db.newsletterSubscriber.deleteMany({ where: { email: { in: ['legacy.one@example.com', 'legacy.two@example.com'] } } })
  console.log(`migration-test cleanup: forms=${forms.count} subs=${subs.count}`)
  console.log('final subscribers (must be 0):', await db.newsletterSubscriber.count())
  console.log('final campaigns:', JSON.stringify(await db.emailCampaign.findMany({ select: { name: true, status: true } })))
}
main().finally(() => db.$disconnect())
