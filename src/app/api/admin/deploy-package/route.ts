import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

export const dynamic = 'force-dynamic'

// Operations-material download: n8n workflows plus deployment reference files.
// The Google Cloud files are legacy templates, not Tech360's Hostinger deploy path.
// No real secrets are included; environment files contain placeholders only.
export async function GET(req: NextRequest) {
  const g = await guard(req, { minRole: 'ADMIN' })
  if (isResponse(g)) return g

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const root = process.cwd()

  const addFolder = (dir: string, zipPath: string, filter?: (f: string) => boolean) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const rel = join(zipPath, name)
      if (statSync(full).isDirectory()) {
        addFolder(full, rel, filter)
      } else if (!filter || filter(name)) {
        try { zip.file(rel, readFileSync(full)) } catch { /* skip unreadable */ }
      }
    }
  }

  addFolder(join(root, 'n8n'), 'n8n-workflows')
  addFolder(join(root, 'deployment'), 'deployment')
  if (existsSync(join(root, '.env.example'))) zip.file('.env.example', readFileSync(join(root, '.env.example')))
  zip.file('PACKAGE-README.md', `TECH360 OPERATIONS MATERIALS
=============================
Generated: ${new Date().toISOString()}

This archive contains workflow and operations references; it is not a complete application source archive and does not prove or perform a production deployment.

Contents:
- n8n-workflows/   — importable workflow JSONs. Configure n8n credentials separately; no real secrets are included.
- deployment/      — legacy Google Cloud Run/Docker templates retained for separately authorized work. They are NOT the supported Tech360 production path; do not use them to deploy bdtech360.com.
- .env.example     — variable names and placeholders only. Never put real values in this archive.
- Current Hostinger deployment and environment-variable guides remain in the source repository under docs/; they are not embedded in this operations-only archive.

For the intended Tech360 deployment, connect the source repository to a Hostinger Node.js Web App in hPanel with the Next.js next preset, Node.js 22.x, npm, build script build (npm run build), and output directory .next. Hostinger's documented Next.js preset starts its bundled standalone server; the repository's npm run start is for CI/manual smoke tests. Do not guess or hard-code a port. Set secrets in Hostinger's environment panel and verify the actual settings/runtime before claiming production is live. Review the MySQL baseline safety guide before any production database migration.

For a separately authorized client deployment, review the legacy templates and replace all project/service/domain settings before use. Import n8n workflows only after separately configuring and testing their credentials.

Support: info@bdtech360.com
`)

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await audit({ actor: g.user.email, action: 'DEPLOY_PACKAGE_DOWNLOADED', userId: g.user.id })
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="tech360-operations-materials-${new Date().toISOString().slice(0, 10)}.zip"`,
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
