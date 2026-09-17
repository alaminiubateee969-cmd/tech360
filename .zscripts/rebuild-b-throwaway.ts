import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const c = await db.emailCampaign.create({
    data: {
      name: 'THROWAWAY send-test campaign',
      subject: 'Throwaway — never to be sent',
      body: '<p>Test body for the honest send gate.</p>',
      status: 'DRAFT',
    },
  })
  console.log('THROWAWAY_ID=' + c.id)
}
main().finally(() => db.$disconnect())
