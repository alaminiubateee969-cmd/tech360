import { NextRequest } from 'next/server'
import { guard, isResponse } from '@/lib/api-guard'
import { audit } from '@/lib/security'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

export const dynamic = 'force-dynamic'

// Deployment package download: n8n workflows + cloud deployment files + docs
// (No secrets inside — .env templates only.)
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
  zip.file('PACKAGE-README.md', `TECH360 DEPLOYMENT PACKAGE
===========================
Generated: ${new Date().toISOString()}

Contents:
- n8n-workflows/   — 25 importable workflow JSONs (automation.bdtech360.com). No secrets inside; configure n8n credentials separately.
- deployment/      — Dockerfile, cloudbuild.yaml, gcloud scripts, service config for Google Cloud Run + Cloud SQL + Secret Manager.
- .env.example     — every environment variable the platform reads. Fill from Secret Manager in production.

Deployment order:
1. gcloud builds submit --config deployment/cloudbuild.yaml
2. gcloud run deploy tech360 --source . (or use deploy.sh)
3. Configure Secret Manager values (see .env.example)
4. Import n8n workflows into automation.bdtech360.com
5. Verify /api/health returns healthy

Support: info@bdtech360.com
`)

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await audit({ actor: g.user.email, action: 'DEPLOY_PACKAGE_DOWNLOADED', userId: g.user.id })
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="tech360-deployment-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  })
}
