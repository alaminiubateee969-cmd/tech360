import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { code } = await params
  const clean = sanitizeText(code, 20).toUpperCase()
  const agent = await db.aiAgent.findUnique({ where: { code: clean }, include: { department: true } })
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })
  const executions = await db.aiAgentExecution.findMany({ where: { agentCode: clean }, orderBy: { createdAt: 'desc' }, take: 25 })
  return Response.json({
    agent: {
      ...agent,
      tools: JSON.parse(agent.tools || '[]'),
      permissions: JSON.parse(agent.permissions || '[]'),
      department: agent.department ? { code: agent.department.code, name: agent.department.name, category: agent.department.category } : null,
    },
    executions,
  })
}
