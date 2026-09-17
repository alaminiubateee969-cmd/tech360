import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const subs = await db.newsletterSubscriber.deleteMany({ where: { email: 'browser.test@footersignup.dev' } })
  const forms = await db.formSubmission.deleteMany({ where: { form: 'NEWSLETTER', email: 'browser.test@footersignup.dev' } })
  const trk = await db.trackingEvent.deleteMany({ where: { OR: [{ path: '/newsletter' }, { path: '/newsletter/unsubscribe' }] } })
  console.log(`cleanup2: subs=${subs.count} forms=${forms.count} tracking=${trk.count}`)
  console.log('final subscriber count (must be 0):', await db.newsletterSubscriber.count())
  const camps = await db.emailCampaign.findMany({ select: { name: true, status: true, agentExecId: true } })
  console.log('final campaigns:', JSON.stringify(camps))
}
main().finally(() => db.$disconnect())
