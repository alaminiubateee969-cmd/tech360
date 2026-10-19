/**
 * TECH360 — AI workforce performance probe.
 *
 * Measures the CPU cost of the platform's own hot paths, in THIS
 * environment. It is not a model benchmark: no model is loaded here.
 * It measures the parts that run on every request — the catalogue
 * builds, the retrievers, the validators and the context assembly.
 *
 * The numbers are honest for the machine they ran on. They are NOT a
 * production claim; the production host must re-run this.
 *
 *   npx tsx scripts/benchmark/workforce.ts [--json <file>]
 */
import { writeFileSync } from 'node:fs'

import { WORKFORCE, workforceStats, validateWorkforce } from '../../src/lib/agents/workforce'
import { SKILL_CATALOG, CAPABILITY_TEMPLATES } from '../../src/lib/skills/catalog'
import { SOP_LIBRARY, getSop } from '../../src/lib/sops/library'
import { buildPromptsForBinding, promptLibraryIndex } from '../../src/lib/prompts/library'
import { retrievePrompts } from '../../src/lib/prompts/retrieval'
import { TOOL_REGISTRY, validateToolRegistry } from '../../src/lib/tools/registry'
import { executeSop } from '../../src/lib/sops/executor'
import { executeSkill } from '../../src/lib/skills/executor'
import { getSkillDefinition } from '../../src/lib/skills/registry'
import { DOMAIN_PROFILES } from '../../src/lib/skills/catalog'

const ITERATIONS = 200

function measure(label: string, iterations: number, fn: () => unknown | Promise<unknown>) {
  // Warm up.
  for (let i = 0; i < 5; i += 1) void fn()
  const started = process.hrtime.bigint()
  for (let i = 0; i < iterations; i += 1) void fn()
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000
  const perCall = elapsedMs / iterations
  return { label, iterations, totalMs: Math.round(elapsedMs * 1000) / 1000, perCallMs: Math.round(perCall * 1000) / 1000, opsPerSecond: Math.round((1000 / perCall) * 10) / 10 }
}

async function main() {
  const results: Array<Record<string, unknown>> = []

  results.push(measure('workforce.validateWorkforce', 50, () => validateWorkforce()))
  results.push(measure('workforce.workforceStats', 200, () => workforceStats()))
  results.push(measure('skills.validateRegistry', 20, () => validateToolRegistry()))
  results.push(measure('tools.validateToolRegistry', 200, () => validateToolRegistry()))
  results.push(measure('prompts.libraryIndex', 50, () => promptLibraryIndex(20)))
  results.push(measure('prompts.materialiseBinding', 200, () => buildPromptsForBinding({ departmentCode: 'D010', roleSlug: 'lead_qualification', roleTitle: 'Lead Qualification Agent' })))
  results.push(
    measure('prompts.retrieve(limit 12)', 200, () =>
      retrievePrompts({
        departmentCode: 'D010',
        roleSlug: 'lead_qualification',
        roleTitle: 'Lead Qualification Agent',
        language: 'en',
        complexity: 'STANDARD',
        limit: 12,
      }),
    ),
  )

  const sop = getSop('D010-INTAKE')!
  const inputs = { subject: 'A new enquiry from Acme about a website', identifier: 'ACME-1', payload: { message: 'We need a website for our company.' } }
  const permissions = [DOMAIN_PROFILES.REVENUE.permission]
  results.push(
    measure('sop.execute(D010-INTAKE, no gateway)', 50, () =>
      executeSop('D010-INTAKE', inputs, { grantedPermissions: permissions, persist: false }),
    ),
  )

  const skill = getSkillDefinition('lead_acquisition_classify_intent', SKILL_CATALOG)
  if (skill) {
    const input = { text: 'we need a website for our company' }
    results.push(
      measure('skill.execute(classify_intent)', 200, () =>
        executeSkill(skill, input, { grantedPermissions: permissions, persist: false, timeoutMs: 5000 }),
      ),
    )
  }

  const summary = {
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      cpus: (await import('node:os')).cpus().length,
      totalMemoryMb: Math.round((await import('node:os')).totalmem() / 1024 / 1024),
      note: 'Sandbox: 2 vCPU, 3.8 GB RAM. These numbers are NOT a production claim.',
    },
    shape: {
      employees: WORKFORCE.length,
      skills: SKILL_CATALOG.length,
      capabilityTemplates: CAPABILITY_TEMPLATES.length,
      procedures: SOP_LIBRARY.length,
      tools: TOOL_REGISTRY.length,
    },
    results,
  }

  const jsonIndex = process.argv.indexOf('--json')
  if (jsonIndex !== -1 && process.argv[jsonIndex + 1]) {
    writeFileSync(process.argv[jsonIndex + 1], JSON.stringify(summary, null, 2))
    console.log(`written to ${process.argv[jsonIndex + 1]}`)
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
