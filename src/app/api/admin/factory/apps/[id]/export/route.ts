import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { verifyFactoryAppScope } from '@/lib/factory/verify-scope'

export const dynamic = 'force-dynamic'

// GET /api/admin/factory/apps/[id]/export — the client deliverable as a ZIP.
// Contains ONLY the generated project (source + scope + handover notes) and a
// manifest. Credentials are never included; .env.example carries names only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g
  const { id } = await params

  const app = await db.generatedApp.findUnique({ where: { id: sanitizeText(id, 40) } })
  if (!app) return Response.json({ error: 'Generated app not found.' }, { status: 404 })

  const boundToClient = Boolean(app.clientId || app.projectId)
  const scopeGate = boundToClient ? await verifyFactoryAppScope(app) : { allowed: false as const, code: 'PROJECT_SCOPE_REQUIRED' as const }
  if (boundToClient && !scopeGate.allowed) {
    return Response.json(
      { error: 'Client export is blocked: the exact FINAL scope and client approval must still match this application.', code: scopeGate.code },
      { status: 409 },
    )
  }
  if (boundToClient && app.status !== 'APPROVED' && app.status !== 'DELIVERED') {
    return Response.json({ error: 'Client source export requires a recorded TECH360 admin review approval.' }, { status: 409 })
  }

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
        scopeBinding: boundToClient && scopeGate.allowed
          ? { scopeId: app.scopeId, scopeVersion: app.scopeVersion, contentSha256: app.scopeHash }
          : null,
        clientDeliveryEligible: boundToClient && scopeGate.allowed,
        deliveryWarning: boundToClient
          ? null
          : 'Internal prototype only: no approved client project scope is linked. This archive is not authorization to deploy or hand over to a customer.',
        secretsIncluded: false,
        note: 'No credential is included in this archive. Populate .env from the client’s own provider accounts.',
      },
      null,
      2,
    ),
  )

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await db.generatedAppEvent.create({
    data: {
      appId: app.id,
      stage: 'DELIVERY',
      status: 'EXPORTED',
      note: boundToClient
        ? `Client source ZIP exported against scope v${app.scopeVersion} (${app.scopeId}). Export is not proof of deployment or receipt.`
        : 'Internal prototype ZIP exported. It is not authorized for customer deployment or handover.',
      actor: g.user.email,
    },
  })
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
