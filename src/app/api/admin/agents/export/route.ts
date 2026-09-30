import { AI_WORKFORCE_MIN_ROLE } from '@/lib/ai-workforce-policy'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

function csvCell(value: unknown, max = 400): string {
  const s = String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/"/g, '""')
    .slice(0, max)
  return `"${s}"`
}

// GET /api/admin/agents/export — machine-readable PROOF of real agent work:
// every AI agent execution with inputs, outputs, status, duration, correlation.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: AI_WORKFORCE_MIN_ROLE })
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? ''
  const take = Math.min(2000, Math.max(1, Number(url.searchParams.get('take') ?? 500) || 500))

  const where = ['SUCCESS', 'FAILED', 'RUNNING', 'TIMEOUT', 'AWAITING_APPROVAL'].includes(status.toUpperCase())
    ? { status: status.toUpperCase() }
    : {}

  const [executions, agents] = await Promise.all([
    db.aiAgentExecution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { agent: { select: { name: true, title: true, department: { select: { name: true } } } } },
    }),
    db.aiAgent.findMany({ select: { code: true, executionCount: true, successCount: true, failureCount: true } }),
  ])

  const totals = {
    executions: executions.length,
    success: executions.filter((e) => e.status === 'SUCCESS').length,
    failed: executions.filter((e) => e.status === 'FAILED').length,
  }

  const lines: string[] = []
  lines.push('# TECH360 AI Agent Execution Evidence')
  lines.push(`# Generated: ${new Date().toISOString()}`)
  lines.push(`# Exported by: ${g.user.email} (${g.user.role})`)
  lines.push(`# Executions in file: ${totals.executions} · SUCCESS: ${totals.success} · FAILED: ${totals.failed}`)
  lines.push(`# Registered agents: ${agents.length} · Total lifetime executions: ${agents.reduce((a, x) => a + x.executionCount, 0)}`)
  lines.push('')
  lines.push([
    'executed_at', 'agent_code', 'agent_name', 'agent_title', 'department',
    'workflow', 'correlation_id', 'client_id', 'status', 'duration_ms',
    'tokens_used', 'input_excerpt', 'output_excerpt', 'error',
  ].join(','))

  for (const e of executions) {
    lines.push([
      csvCell(e.createdAt.toISOString(), 30),
      csvCell(e.agentCode, 20),
      csvCell(e.agent?.name, 80),
      csvCell(e.agent?.title, 80),
      csvCell(e.agent?.department?.name, 60),
      csvCell(e.workflow, 60),
      csvCell(e.correlationId, 40),
      csvCell(e.clientId, 30),
      csvCell(e.status, 20),
      csvCell(e.durationMs, 10),
      csvCell(e.tokensUsed, 10),
      csvCell(e.input, 300),
      csvCell(e.output, 400),
      csvCell(e.error, 200),
    ].join(','))
  }

  await audit({
    actor: g.user.email, action: 'AGENT_EVIDENCE_EXPORTED', userId: g.user.id,
    details: { executions: totals.executions, success: totals.success, failed: totals.failed },
  })

  const csv = lines.join('\n')
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tech360-ai-agent-evidence-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
