import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { guardFailed, noStore, requireActor } from '@/lib/factory/control/http'

export const dynamic = 'force-dynamic'

const DOC_FILES = [
  'docs/SFCC_GAP_ANALYSIS_AND_PLAN.md',
  'docs/SFCC_OPERATIONS.md',
  'docs/SFCC_ACCEPTANCE_RESULTS.md',
  'docs/BACKUP_AND_RESTORE.md',
  'docs/ROLLBACK_AND_RECOVERY_GUIDE.md',
  'THIRD_PARTY_NOTICES.md',
  'SECURITY.md',
  'DEPLOYMENT.md',
]

export async function GET(req: NextRequest) {
  const g = await requireActor(req)
  if (guardFailed(g)) return g
  const root = process.cwd()
  return noStore({
    documents: DOC_FILES.map((path) => ({ path, exists: existsSync(join(root, path)) })),
    pipeline: ['Select a template', 'Configure the company', 'Select modules', 'Validate', 'Provision', 'Test', 'Approve', 'Deploy', 'Monitor'],
    automatedSteps: [
      'Definition + dependency + compatibility validation',
      'Isolated identity, versioned definition, roles and grants',
      'Pinned module versions, generated configuration, seeded module entities',
      'Integration adapter registration with honest status',
      'Automated acceptance checks, verified backup, health checks',
    ],
    manualSteps: [
      'Review provisioning result and approve activation',
      'Dedicated-instance infrastructure, DNS, TLS, credentials and evidence recording',
      'External provider accounts, approvals and fee arrangements',
      'New business logic, migrations or integrations that are not configuration-only',
    ],
  })
}
