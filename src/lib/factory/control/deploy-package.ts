/**
 * Self-hosted DEDICATED deployment package generator.
 *
 * Honest boundary: the Software Factory can generate a complete, checksummed,
 * reproducible deployment package for an authorized BDTECH360-controlled
 * server, but it does NOT create external DNS records, databases, TLS
 * certificates or credentials from inside the web request. Those steps belong
 * to the operator who controls the infrastructure; activating a DEDICATED
 * application requires recorded evidence that they were completed.
 *
 * The package contains only real repository commands, real environment keys
 * and real, database-read application state. No credentials are included.
 */
import { db } from '@/lib/db'
import type { ApplicationConfig } from './types'
import { checksum, jsonText, parseJson, secretLikeReason } from './util'

export interface DeploymentPackage {
  type: 'BDTECH360_FACTORY_DEPLOYMENT_PACKAGE'
  schemaVersion: 1
  generatedAt: string
  generator: string
  application: Record<string, unknown>
  company: Record<string, unknown>
  template: Record<string, unknown>
  config: { checksum: string; revision: number | null; theme: unknown; pages: unknown; navigation: unknown }
  modulePins: Array<{ code: string; semver: string; enabled: boolean }>
  runtime: Record<string, unknown>
  environmentTemplate: string[]
  commands: string[]
  migrations: string[]
  verification: string[]
  infrastructureChecklist: string[]
  boundaries: string[]
  recovery: Record<string, unknown>
  packageChecksum: string
}

/** Build a package from real persisted rows. Throws when the app is unknown. */
export async function buildDeploymentPackage(applicationId: string): Promise<DeploymentPackage> {
  const app = await db.factoryApplication.findUniqueOrThrow({ where: { id: applicationId } })
  const company = await db.factoryCompany.findUniqueOrThrow({ where: { id: app.companyId } })
  const [template, templateVersion, pins, revisions, backups, releases, migrationFiles] = await Promise.all([
    db.factoryTemplate.findUnique({ where: { id: app.templateId } }),
    db.factoryTemplateVersion.findUnique({ where: { id: app.templateVersionId } }),
    db.factoryAppModule.findMany({ where: { applicationId }, orderBy: { moduleId: 'asc' } }),
    db.factoryConfigRevision.findMany({ where: { applicationId }, orderBy: { version: 'desc' }, take: 1 }),
    db.factoryBackup.findMany({ where: { applicationId, verifiedAt: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1 }),
    db.factoryRelease.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' }, take: 1 }),
    Promise.resolve(['prisma/migrations (apply in order with npm run db:deploy)']),
  ])
  const { tenantKey: _omit, ...companySafe } = company
  const config = parseJson<ApplicationConfig>(app.config, {} as ApplicationConfig)
  const base: Omit<DeploymentPackage, 'packageChecksum'> = {
    type: 'BDTECH360_FACTORY_DEPLOYMENT_PACKAGE',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: 'BDTECH360 Software Factory Control Center',
    application: {
      id: app.id, code: app.code, name: app.name, status: app.status, environment: app.environment,
      deploymentModel: app.deploymentModel, releaseVersion: app.releaseVersion, domain: app.domain,
      configChecksum: app.configChecksum, healthStatus: app.healthStatus,
    },
    company: { id: companySafe.id, code: companySafe.code, slug: companySafe.slug, name: companySafe.name, kind: companySafe.kind, industry: companySafe.industry, isolationModel: companySafe.isolationModel },
    template: { code: template?.code ?? null, name: template?.name ?? null, version: templateVersion?.version ?? null, semver: templateVersion?.semver ?? null },
    config: { checksum: app.configChecksum, revision: revisions[0]?.version ?? null, theme: config.theme ?? null, pages: config.pages ?? null, navigation: config.navigation ?? [] },
    modulePins: pins.map((p) => ({ code: p.moduleId, semver: p.semver, enabled: p.enabled })),
    runtime: {
      model: 'SHARED_RUNTIME_CONFIGURATION_DRIVEN',
      renderUrl: `/factory/apps/${company.slug}`,
      portalUrl: '/factory/apps',
      stateApi: `/api/factory/runtime/${company.slug}`,
      singleCodebase: true,
      note: 'One Next.js runtime reads this versioned configuration. No per-company source tree is generated or required.',
    },
    environmentTemplate: [
      'NODE_ENV=production',
      'DATABASE_URL=<MySQL connection string; supply real credentials on the authorized host, never in this package>',
      'SESSION_SECRET=<generate 32+ random bytes on the host>',
      'IDENTITY_HASH_SECRET=<generate 32+ random bytes on the host>',
      'APP_PUBLIC_URL=https://<approved-domain>',
      'APP_ORIGIN=https://<approved-domain>',
      'PORT=3000',
      'BACKUP_DIR=/var/lib/bdtech360/backups',
      'PORTAL_OTP=on',
    ],
    commands: [
      'git clone <private repository> /srv/bdtech360 && cd /srv/bdtech360',
      'git checkout <approved release commit>',
      'npm ci --no-audit --no-fund',
      'npm run install:check',
      'npm run db:deploy',
      'npm run build',
      'npm run start:check',
      'npm start',
    ],
    migrations: migrationFiles,
    verification: [
      'npm run typecheck && npm run lint',
      'npm test',
      'npm run schema:drift && npm run schema:check',
      'node scripts/factory/gen-control-ddl.mjs --check',
      'SFCC_BASE_URL=https://<approved-domain> node scripts/factory/verify-http.mjs',
      'GET /api/factory/runtime/<slug> with an explicit company grant must return 200 and the matching config checksum',
      'POST /api/factory/runtime/<slug> { action: "tests.run" } must persist a PASSED TEST job',
    ],
    infrastructureChecklist: [
      'Provision a separate MySQL database and a least-privilege database user on BDTECH360-authorized infrastructure.',
      'Create the DNS record for the approved domain and point it at the host.',
      'Issue and renew a TLS certificate for the approved domain (reverse proxy or platform TLS).',
      'Store credentials, secrets and backup encryption keys in the host secret manager; never in the repository.',
      'Restrict the private portal and /api/factory/* to authorized networks/accounts.',
      'Schedule and test the portable backup export plus a restore drill in the SAME company scope.',
      'Record the deployment evidence (change ticket URI, operator, date) before activating this DEDICATED application.',
    ],
    boundaries: [
      'This package does not create a DNS record, database, TLS certificate, server or credential.',
      'No credential value is included in the package; envTemplate contains placeholders only.',
      'DEDICATED activation is refused by the lifecycle gate until deploymentEvidence is recorded and a verified rollback point exists.',
      'Cross-company restore and cross-company data access remain refused at the API and service layers.',
    ],
    recovery: {
      latestVerifiedBackup: backups[0] ? { id: backups[0].id, code: backups[0].code, verifiedAt: backups[0].verifiedAt } : null,
      latestRelease: releases[0] ? { code: releases[0].code, status: releases[0].status } : null,
      rollback: 'POST /api/factory/releases with action rollback restores config revisions, exact module pins, records and files from the verified portable payload.',
      restoreDrill: 'POST /api/factory/backups { action: "restore", backupId } creates a NEW STAGING application in the same company and verifies integrity.',
    },
  }
  const secret = secretLikeReason(base)
  if (secret) throw new Error(`Refusing to export a deployment package containing ${secret}`)
  // The checksum is computed over the package WITHOUT the checksum field, so
  // a recipient can recompute it after removing `packageChecksum`.
  const packageChecksum = checksum(base)
  return { ...base, packageChecksum }
}

/** Compact, downloadable representation (JSON with a stable key order). */
export function serializeDeploymentPackage(pkg: DeploymentPackage): string {
  return jsonText(pkg)
}
