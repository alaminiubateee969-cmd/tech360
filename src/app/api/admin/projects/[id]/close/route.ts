import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText } from '@/lib/security'
import { closeProject } from '@/lib/journey'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'SUPER_ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params
  const ref = sanitizeText(id, 40)
  const project = await db.project.findFirst({ where: { OR: [{ id: ref }, { code: ref }] } })
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 })
  try {
    await closeProject(project.id, g.user.email)
    return Response.json({ ok: true, message: 'Project closed. Pipeline set to COMPLETED.' })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : 'unknown', message: e instanceof Error ? e.message : 'Close failed' }, { status: 400 })
  }
}
