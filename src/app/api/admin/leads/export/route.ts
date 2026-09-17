import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// GET /api/admin/leads/export — CSV export of every non-deleted
// client record (leads + clients) for CRM import / spreadsheets.
// Standard RFC 4180-style escaping: fields containing , " or
// newlines are wrapped in quotes with embedded quotes doubled.
// ------------------------------------------------------------

function csvCell(value: unknown): string {
  const s = String(value ?? '')
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const clients = await db.client.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      clientId: true, name: true, businessName: true, email: true, phone: true,
      source: true, status: true, pipelineStage: true, score: true, createdAt: true,
    },
  })

  const header = ['Client ID', 'Name', 'Business', 'Email', 'Phone', 'Source', 'Status', 'Pipeline Stage', 'Score', 'Created (UTC ISO)']
  const lines = [header.map(csvCell).join(',')]
  for (const c of clients) {
    lines.push(
      [
        csvCell(c.clientId),
        csvCell(c.name),
        csvCell(c.businessName ?? ''),
        csvCell(c.email ?? ''),
        csvCell(c.phone ?? ''),
        csvCell(c.source),
        csvCell(c.status),
        csvCell(c.pipelineStage),
        csvCell(c.score),
        csvCell(c.createdAt.toISOString()),
      ].join(','),
    )
  }

  await audit({
    actor: g.user.email,
    action: 'LEADS_EXPORTED',
    userId: g.user.id,
    details: { exported: clients.length },
  })

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return new Response(lines.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tech360-leads-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
