import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const h = await db.handoverRecord.findFirst({ where: { status: { in: ['RELEASED', 'DOWNLOADED', 'CONFIRMED'] } }, orderBy: { releasedAt: 'desc' } })
console.log(JSON.stringify({ token: h?.packageToken, status: h?.status, project: h?.projectId }))
await db.$disconnect()
