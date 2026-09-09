import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const g = await guard(req)
  if (isResponse(g)) return g
  const { code } = await params
  const clean = sanitizeText(code, 30).toUpperCase().replace(/[^A-Z0-9_]/g, '')
  const workflow = await db.n8nWorkflow.findUnique({ where: { code: clean } })
  if (!workflow) return Response.json({ error: 'Workflow not found' }, { status: 404 })

  // Prefer the full importable JSON from the n8n folder
  const file = join(process.cwd(), 'n8n', `${clean}.json`)
  let definition: unknown = JSON.parse(workflow.definition || '{}')
  if (existsSync(file)) {
    try { definition = JSON.parse(readFileSync(file, 'utf-8')) } catch { /* fall back to registry */ }
  }
  return new Response(JSON.stringify(definition, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${clean}.json"`,
    },
  })
}
