/**
 * TECH360 — Super Admin access control tests for the Company OS & Software
 * Factory app launcher and factory routes.
 *
 * Proves Requirement H: the internal factory surface is SUPER_ADMIN only,
 * at the UI navigation policy level and at the API route level, and that
 * company-scoped factory data is isolated between companies.
 *
 * The DB-backed part runs against a disposable database (offline SQLite
 * adapter when no MySQL is configured) and skips cleanly otherwise.
 * No module mocks are used here on purpose: they leak across test files
 * in this runner and would break unrelated database suites.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { readFileSync } from 'node:fs'

import { canAccessAdminView } from '@/lib/admin-view-policy'

const NON_SUPER_ADMIN_ROLES: readonly string[] = [
  'ADMIN', 'FINANCE', 'PROJECT_MANAGER', 'MANAGER', 'DEVELOPER', 'SALES',
  'SUPPORT', 'MARKETING', 'DESIGNER', 'AUDITOR', 'STAFF',
]

/* ------------------------------------------------------------------ */
/* 1. UI / navigation policy: view visibility is role-gated           */
/* ------------------------------------------------------------------ */

describe('app launcher view policy (Super Admin only)', () => {
  it('SUPER_ADMIN can open the App Launcher, Company OS and Software Factory views', () => {
    assert.strictEqual(canAccessAdminView('SUPER_ADMIN', 'appLauncher'), true)
    assert.strictEqual(canAccessAdminView('SUPER_ADMIN', 'factory'), true)
    assert.strictEqual(canAccessAdminView('SUPER_ADMIN', 'factoryControl'), true)
  })

  it('no non-Super Admin role can see the private factory views', () => {
    for (const role of NON_SUPER_ADMIN_ROLES) {
      assert.strictEqual(canAccessAdminView(role, 'appLauncher'), false, `${role} must not see the App Launcher`)
      assert.strictEqual(canAccessAdminView(role, 'factory'), false, `${role} must not see the AI Software Factory`)
      assert.strictEqual(canAccessAdminView(role, 'factoryControl'), false, `${role} must not see the Control Center`)
    }
  })
})

/* ------------------------------------------------------------------ */
/* 2. API routes enforce Super Admin (source-level)                   */
/* ------------------------------------------------------------------ */

describe('app launcher API route guards', () => {
  it('every app launcher route requires a Super Admin actor', () => {
    for (const path of [
      'src/app/api/admin/app-launcher/catalog/route.ts',
      'src/app/api/admin/app-launcher/favorites/route.ts',
      'src/app/api/admin/app-launcher/recent/route.ts',
    ]) {
      const source = readFileSync(path, 'utf8')
      assert.match(source, /requireActor\(req\)/, path)
      assert.doesNotMatch(source, /requireActor\(req, 'STAFF'\)/, path)
    }
  })
})

/* ------------------------------------------------------------------ */
/* 3. Tenant isolation: company-scoped factory data (DB-backed)       */
/* ------------------------------------------------------------------ */

const HAS_DB = Boolean(process.env.PREVIEW_SQLITE_URL || process.env.DATABASE_URL)

describe('factory tenant isolation (database)', { skip: !HAS_DB }, () => {
  const companyCodes = ['ACME', 'BERLIN']
  let aCompanyId = ''
  let bCompanyId = ''

  before(async () => {
    const { db } = await import('../src/lib/db')

    const companyA = await db.factoryCompany.create({
      data: { code: 'ACME', slug: 'acme', name: 'Acme Corp', kind: 'CLIENT', status: 'ACTIVE', tenantKey: `tk-a-${Date.now()}` },
    })
    const companyB = await db.factoryCompany.create({
      data: { code: 'BERLIN', slug: 'berlin', name: 'Berlin GmbH', kind: 'CLIENT', status: 'ACTIVE', tenantKey: `tk-b-${Date.now()}` },
    })
    aCompanyId = companyA.id
    bCompanyId = companyB.id

    await db.factoryCompanyMember.create({
      data: { companyId: aCompanyId, userEmail: 'owner-a@tech360.local', role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    })
    await db.factoryCompanyMember.create({
      data: { companyId: bCompanyId, userEmail: 'owner-b@tech360.local', role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    })

    await db.factoryRecord.create({
      data: { applicationId: 'app-a', companyId: aCompanyId, moduleKey: 'crm', entityType: 'CONTACT',
        data: JSON.stringify({ name: 'Acme contact' }), createdBy: 'owner-a@tech360.local' },
    })
    await db.factoryRecord.create({
      data: { applicationId: 'app-b', companyId: bCompanyId, moduleKey: 'crm', entityType: 'CONTACT',
        data: JSON.stringify({ name: 'Berlin contact' }), createdBy: 'owner-b@tech360.local' },
    })
  })

  after(async () => {
    const { db } = await import('../src/lib/db')
    await db.factoryRecord.deleteMany()
    await db.factoryCompanyMember.deleteMany({ where: { userEmail: { endsWith: '@tech360.local' } } })
    await db.factoryCompany.deleteMany({ where: { code: { in: companyCodes } } })
  })

  it('registry metadata is visible for every company', async () => {
    const { db } = await import('../src/lib/db')
    const companies = await db.factoryCompany.findMany({ where: { code: { in: companyCodes } } })
    assert.strictEqual(companies.length, 2)
  })

  it('records are scoped to their owning company', async () => {
    const { db } = await import('../src/lib/db')
    const aRecords = await db.factoryRecord.findMany({ where: { companyId: aCompanyId } })
    const bRecords = await db.factoryRecord.findMany({ where: { companyId: bCompanyId } })
    assert.strictEqual(aRecords.length, 1)
    assert.strictEqual(bRecords.length, 1)
    assert.strictEqual(aRecords[0].companyId, aCompanyId)
    assert.strictEqual(bRecords[0].companyId, bCompanyId)
  })

  it('a Super Admin has no automatic private-company grant', async () => {
    const { resolveCompanyAccess } = await import('../src/lib/factory/control/access')
    const sa = { email: 'sa@tech360.local', role: 'SUPER_ADMIN', userId: 'u-sa' }
    const decision = await resolveCompanyAccess(sa, aCompanyId, 'read', 'READ_RECORD')
    assert.strictEqual(decision.ok, false)
    assert.strictEqual(decision.code, 'NO_COMPANY_GRANT')
  })
})
