import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'

export const dynamic = 'force-dynamic'

// GET /api/admin/factory/apps/[id]/export — the client deliverable as a ZIP.
// Contains ONLY the generated project (source + scope + handover notes) and a
// manifest. Credentials are never included; .env.example carries names only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'MANAGER' })
  if (isResponse(g)) return g
  const { id } = await params

  const app = await db.generatedApp.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!app) return Response.json({ error: 'Generated app not found.' }, { status: 404 })

  const files = await db.generatedAppFile.findMany({ where: { appId: app.id }, orderBy: { path: 'asc' } })
  if (files.length === 0) return Response.json({ error: 'This app has no generated files yet — run the plan action first.' }, { status: 409 })

  const plan = (() => {
    try {
      return JSON.parse(app.plan) as { slug?: string; summary?: string; acceptanceCriteria?: string[]; notBuilt?: string[] }
    } catch {
      return {}
    }
  })()

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const f of files) zip.file(f.path, f.content)

  zip.file(
    'DELIVERY-MANIFEST.json',
    JSON.stringify(
      {
        generatedBy: 'TECH360 AI Software Factory',
        appCode: app.code,
        appName: app.name,
        vertical: app.vertical,
        status: app.status,
        stage: app.stage,
        exportedAt: new Date().toISOString(),
        fileCount: files.length,
        files: files.map((f) => ({ path: f.path, bytes: f.bytes })),
        scopeSummary: plan.summary ?? null,
        acceptanceCriteria: plan.acceptanceCriteria ?? [],
        explicitlyNotBuilt: plan.notBuilt ?? [],
        secretsIncluded: false,
        note: 'No credential is included in this archive. Populate .env from the client’s own provider accounts.',
      },
      null,
      2,
    ),
  )

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await audit({ actor: g.user.email, action: 'FACTORY_APP_EXPORTED', userId: g.user.id, details: `${app.code} (${files.length} files)` })

  const filename = `${plan.slug ?? app.code.toLowerCase()}-source-${new Date().toISOString().slice(0, 10)}.zip`
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
