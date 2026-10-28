import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, isResponse } from '@/lib/api-guard'
import { sanitizeText, audit } from '@/lib/security'
import { normalizeBrief, buildPlan, buildFiles, summarizeFiles, assertNoSecrets, type FactoryBrief } from '@/lib/factory/blueprint'

export const dynamic = 'force-dynamic'

// AI Software Factory — generated client applications.
// One brief form in, one reviewed Next.js + Prisma + Tailwind project out,
// stored file-by-file so it can be reviewed, exported and handed over.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const url = new URL(req.url)
  const q = sanitizeText(url.searchParams.get('q') ?? '', 80)
  const status = sanitizeText(url.searchParams.get('status') ?? '', 24).toUpperCase()
  const vertical = sanitizeText(url.searchParams.get('vertical') ?? '', 24).toLowerCase()

  const [apps, projects] = await Promise.all([
    db.generatedApp.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(vertical ? { vertical } : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { clientId: { contains: q } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.project.findMany({
      where: { deletedAt: null, status: { not: 'CANCELLED' } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        code: true,
        name: true,
        clientId: true,
        client: { select: { name: true, businessName: true } },
        scopes: {
          where: { status: 'FINAL' },
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            approvedAt: true,
            approvals: {
              orderBy: { decidedAt: 'desc' },
              take: 1,
              select: { decision: true, clientId: true },
            },
          },
        },
      },
    }),
  ])

  const deliveryProjects = projects.map((project) => {
    const scope = project.scopes[0]
    const approval = scope?.approvals[0]
    const approvedScope = scope && scope.approvedAt && approval?.decision === 'APPROVED' && approval.clientId === project.clientId
      ? { id: scope.id, version: scope.version }
      : null
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      clientId: project.clientId,
      clientName: project.client.businessName || project.client.name,
      approvedScope,
    }
  })

  return Response.json({ apps, total: apps.length, projects: deliveryProjects })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const brief: FactoryBrief = normalizeBrief({
    appName: body.appName,
    clientName: body.clientName,
    vertical: body.vertical,
    modules: body.modules,
    language: body.language,
    currency: body.currency,
    primaryColor: body.primaryColor,
    primaryContact: body.primaryContact,
    notes: body.notes,
  })

  const plan = buildPlan(brief)
  const files = buildFiles(brief, plan)
  const secrets = assertNoSecrets(files)
  if (!secrets.ok) {
    // Hard stop: a generated file must never carry credential-shaped content.
    return Response.json({ error: `Generated file ${secrets.path} contains secret-like content — generation aborted.` }, { status: 500 })
  }
  const { fileCount, totalBytes } = summarizeFiles(files)

  const requestedClientId = sanitizeText(body.clientId ?? '', 40).trim() || null
  const projectRef = sanitizeText(body.projectId ?? '', 40).trim() || null
  let clientId = requestedClientId
  let projectId: string | null = null
  let scopeSnapshot: { id: string; version: number; hash: string } | null = null

  if (projectRef) {
    const project = await db.project.findFirst({
      where: { OR: [{ id: projectRef }, { code: projectRef }] },
      select: { id: true, clientId: true, status: true, deletedAt: true },
    })
    if (!project || project.deletedAt || project.status === 'CANCELLED') {
      return Response.json({ error: 'An active project is required for client-bound generation.' }, { status: 404 })
    }
    if (requestedClientId && requestedClientId !== project.clientId) {
      return Response.json({ error: 'The selected project does not belong to the selected client.' }, { status: 409 })
    }

    const scope = await db.scopeOfWork.findFirst({
      where: { clientId: project.clientId, projectId: project.id, status: 'FINAL', approvedAt: { not: null } },
      orderBy: { version: 'desc' },
      include: {
        approvals: { orderBy: { decidedAt: 'desc' }, take: 1, select: { decision: true, clientId: true } },
      },
    })
    const clientApproval = scope?.approvals[0]
    if (!scope || clientApproval?.decision !== 'APPROVED' || clientApproval.clientId !== project.clientId) {
      return Response.json(
        { error: 'Client-bound generation requires a FINAL scope approved by the client for this exact project.' },
        { status: 409 },
      )
    }

    clientId = project.clientId
    projectId = project.id
    scopeSnapshot = {
      id: scope.id,
      version: scope.version,
      hash: createHash('sha256').update(scope.content, 'utf8').digest('hex'),
    }
  } else if (requestedClientId) {
    return Response.json({ error: 'A client-bound application must reference a project with an approved scope.' }, { status: 400 })
  }

  const count = await db.generatedApp.count()
  const code = `AF-${String(count + 1).padStart(4, '0')}`

  // Tables are intentionally relation-free, so the app, its files and its first
  // stage event are written as three explicit steps rather than a nested create.
  const app = await db.generatedApp.create({
    data: {
      code,
      name: brief.appName,
      clientId,
      projectId,
      scopeId: scopeSnapshot?.id ?? null,
      scopeVersion: scopeSnapshot?.version ?? null,
      scopeHash: scopeSnapshot?.hash ?? null,
      vertical: brief.vertical,
      brief: JSON.stringify(brief),
      plan: JSON.stringify(plan),
      status: 'PLANNED',
      stage: 'PLAN',
      fileCount,
      totalBytes,
      createdBy: g.user.email,
    },
  })
  await db.generatedAppFile.createMany({
    data: files.map((f) => ({ appId: app.id, path: f.path, language: f.language, bytes: Buffer.byteLength(f.content, 'utf8'), content: f.content })),
  })
  await db.generatedAppEvent.create({
    data: {
      appId: app.id,
      stage: 'PLAN',
      status: 'PLANNED',
      note: `Blueprint generated for ${brief.clientName}: ${plan.pages.length} pages, ${plan.models.length} models, ${plan.endpoints.length} endpoints, ${fileCount} files.`,
      actor: g.user.email,
    },
  })

  await audit({ actor: g.user.email, action: 'FACTORY_APP_GENERATED', userId: g.user.id, details: `${code} ${brief.appName} (${brief.vertical}) → ${fileCount} files` })

  return Response.json({ app, plan, fileCount, totalBytes }, { status: 201 })
}
