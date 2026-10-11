import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { evaluateHandoverGate } from '@/lib/commerce-policy'
import { parseHandoverManifest, verifyHandoverArtifacts } from '@/lib/handover-artifacts'
import { sanitizeText, clientIp, audit, logError, rateLimit } from '@/lib/security'
import { normalizeUploadName } from '@/lib/files'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_ZIP_BYTES = 30 * 1024 * 1024

// Returns the actual approved project files as a ZIP. A manifest or certificate
// alone is never recorded as a source-package download.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = clientIp(req)
  const rl = rateLimit(`handover-download:${ip}`, 10, 60_000)
  if (!rl.ok) return Response.json({ error: 'Too many download requests. Try again shortly.' }, { status: 429 })

  const clean = sanitizeText(token, 64).replace(/[^a-f0-9]/gi, '')
  const handover = await db.handoverRecord.findUnique({
    where: { packageToken: clean },
    include: { project: { include: { payments: true, client: true } } },
  })
  if (!handover) return Response.json({ error: 'Package not found' }, { status: 404 })

  const paid = handover.project.payments
    .filter((payment) => payment.status === 'PAID')
    .reduce((total, payment) => total + payment.amount, 0)
  const gate = evaluateHandoverGate({
    status: handover.status,
    totalAmount: handover.project.totalAmount,
    paidAmount: paid,
    expiryAt: handover.expiryAt,
  })
  if (!gate.allowed) {
    const status = gate.code === 'EXPIRED' ? 410 : 403
    await logError({
      source: 'SECURITY',
      code: 'HANDOVER_ACCESS_BLOCKED',
      message: `Package download blocked (${gate.code}) from ${ip}`,
      clientId: handover.project.client.clientId,
      workflow: 'HANDOVER_DOWNLOAD',
    })
    return Response.json({ error: gate.code === 'EXPIRED' ? 'This package link has expired.' : 'This package is not released or full payment is not verified.' }, { status })
  }

  const manifest = parseHandoverManifest(handover.contents, handover.projectId)
  if (!manifest) {
    await logError({ source: 'SECURITY', code: 'HANDOVER_MANIFEST_INVALID', message: `Handover ${handover.id} has no valid artifact manifest`, clientId: handover.project.client.clientId, workflow: 'HANDOVER_DOWNLOAD' })
    return Response.json({ error: 'This legacy handover has no verifiable artifact package. Contact TECH360 support; no manifest-only download was recorded.' }, { status: 409 })
  }

  try {
    const artifacts = await db.fileRecord.findMany({
      where: {
        id: { in: manifest.files.map((file) => file.id) },
        clientId: handover.clientId,
        projectId: handover.projectId,
        relatedType: 'DELIVERY',
        scanStatus: 'CLEAN',
        classification: { in: ['PUBLIC', 'PRIVATE'] },
        content: { not: null },
        sha256: { not: null },
      },
      select: { id: true, originalName: true, mimeType: true, size: true, sha256: true, clientId: true, projectId: true, relatedType: true, scanStatus: true, classification: true, content: true },
    })
    if (!verifyHandoverArtifacts(manifest, artifacts, handover.clientId)) {
      await logError({ source: 'SECURITY', code: 'HANDOVER_ARTIFACT_CHANGED', message: `Approved artifact bytes, hashes, or scan state changed for project ${handover.project.code}`, clientId: handover.project.client.clientId, workflow: 'HANDOVER_DOWNLOAD' })
      return Response.json({ error: 'An approved artifact is missing or no longer matches its verified hash. Contact TECH360 support; no package was downloaded.' }, { status: 409 })
    }

    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    const usedNames = new Set<string>()
    for (const manifestFile of manifest.files) {
      const artifact = artifacts.find((record) => record.id === manifestFile.id)
      if (!artifact?.content) return Response.json({ error: 'An approved artifact is unavailable.' }, { status: 409 })
      const safeBaseName = normalizeUploadName(manifestFile.name, `artifact-${manifestFile.id.slice(-8)}`)
      const dot = safeBaseName.lastIndexOf('.')
      const stem = dot > 0 ? safeBaseName.slice(0, dot) : safeBaseName
      const ext = dot > 0 ? safeBaseName.slice(dot) : ''
      let archiveName = `source/${safeBaseName}`
      if (usedNames.has(archiveName)) archiveName = `source/${stem}-${manifestFile.id.slice(0, 8)}${ext}`
      usedNames.add(archiveName)
      zip.file(archiveName, Buffer.from(artifact.content), { binary: true })
    }

    zip.file('handover-manifest.json', JSON.stringify({
      format: 'TECH360_HANDOVER_V1',
      project: { code: handover.project.code, name: handover.project.name },
      clientReference: handover.project.client.clientId,
      releasedAt: handover.releasedAt,
      generatedAt: new Date().toISOString(),
      artifacts: manifest.files.map(({ name, mimeType, size, sha256 }) => ({ name, mimeType, size, sha256 })),
      scanDisclosure: 'Files passed TECH360 deterministic structural and credential-pattern checks. External malware scanning is not configured.',
    }, null, 2))

    const zipBytes = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      streamFiles: true,
    })
    if (zipBytes.byteLength === 0 || zipBytes.byteLength > MAX_ZIP_BYTES) {
      return Response.json({ error: 'The generated package exceeds the secure download size limit.' }, { status: 413 })
    }

    const now = new Date()
    if (handover.status !== 'CONFIRMED') {
      await db.handoverRecord.update({
        where: { id: handover.id },
        data: { status: 'DOWNLOADED', downloadedAt: now },
      })
    }
    const packageSha256 = createHash('sha256').update(zipBytes).digest('hex')
    await audit({
      actor: `client:${handover.project.client.clientId}`,
      action: 'SOURCE_PACKAGE_DOWNLOADED',
      clientId: handover.project.client.clientId,
      projectId: handover.projectId,
      ip,
      details: { packageToken: clean.slice(0, 8), artifactCount: manifest.files.length, packageSha256 },
    })

    const projectCode = sanitizeText(handover.project.code, 80).replace(/[^a-zA-Z0-9._-]/g, '-')
    return new Response(new Uint8Array(zipBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="tech360-${projectCode}-handover.zip"`,
        'Content-Length': String(zipBytes.byteLength),
        'Cache-Control': 'no-store, max-age=0',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Artifact-SHA256': packageSha256,
      },
    })
  } catch (error) {
    await logError({
      source: 'API',
      code: 'HANDOVER_PACKAGE_BUILD_FAILED',
      message: error instanceof Error ? error.message : 'Unknown package generation error',
      clientId: handover.project.client.clientId,
      workflow: 'HANDOVER_DOWNLOAD',
    })
    return Response.json({ error: 'The approved project package could not be assembled. No download was recorded.' }, { status: 500 })
  }
}
