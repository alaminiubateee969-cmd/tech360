#!/usr/bin/env node
/**
 * Integration regression for the one-time production bootstrap seed.
 * Guarded to a disposable loopback CI database; never runs against production.
 */
import { spawnSync } from 'node:child_process'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const databaseUrl = process.env.DATABASE_URL

function fail(message) {
  console.error(`[seed-safety] FAILED: ${message}`)
  process.exitCode = 1
}

function isTestDatabase(value) {
  try {
    const url = new URL(value)
    const name = decodeURIComponent(url.pathname.replace(/^\//, ''))
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
      && ['tech360_ci', 'tech360_test'].includes(name)
  } catch {
    return false
  }
}

if (process.env.CI !== 'true' || !databaseUrl || !isTestDatabase(databaseUrl)) {
  fail('requires CI=true and a loopback tech360_ci/tech360_test DATABASE_URL')
  process.exit(1)
}

const email = `seed-safety-${randomBytes(8).toString('hex')}@example.invalid`
const password = randomBytes(32).toString('base64url')
const seedEnvironment = {
  ...process.env,
  NODE_ENV: 'production',
  ADMIN_EMAIL: email,
  ADMIN_PASSWORD: password,
}
const seedCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const seedFile = path.join(root, 'prisma', 'seed.ts')
const db = new PrismaClient()

function runSeed() {
  const result = spawnSync(process.execPath, [seedCli, seedFile], {
    cwd: root,
    env: seedEnvironment,
    stdio: 'inherit',
  })
  if (result.error || result.status !== 0) {
    throw new Error('seed process returned a non-zero status')
  }
}

function passwordMatches(encoded) {
  const [scheme, salt, hash] = encoded.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, 64)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

async function recordCounts() {
  const [departments, agents, prompts, workflows, memories, posts, settings, adminUsers] = await Promise.all([
    db.department.count(),
    db.aiAgent.count(),
    db.promptTemplate.count(),
    db.n8nWorkflow.count(),
    db.aiMemory.count(),
    db.blogPost.count(),
    db.setting.count(),
    db.user.count({ where: { email } }),
  ])
  return { departments, agents, prompts, workflows, memories, posts, settings, adminUsers }
}

async function main() {
  try {
    runSeed()

    const admin = await db.user.findUnique({ where: { email } })
    if (!admin || admin.role !== 'SUPER_ADMIN' || !admin.mustChangePassword || !passwordMatches(admin.passwordHash)) {
      throw new Error('initial Super Admin bootstrap did not satisfy the expected production policy')
    }
    const originalPasswordHash = admin.passwordHash
    const initialCounts = await recordCounts()

    const department = await db.department.findFirst()
    const agent = await db.aiAgent.findFirst()
    const prompt = await db.promptTemplate.findFirst()
    const workflow = await db.n8nWorkflow.findFirst()
    const memory = await db.aiMemory.findFirst({ where: { scope: 'COMPANY', key: 'identity' } })
    const post = await db.blogPost.findFirst()
    const setting = await db.setting.findUnique({ where: { key: 'site.metaPixelId' } })
    if (!department || !agent || !prompt || !workflow || !memory || !post || !setting) {
      throw new Error('seed did not create every required core record')
    }

    await Promise.all([
      db.department.update({ where: { id: department.id }, data: { name: 'CI operator-managed department' } }),
      db.aiAgent.update({ where: { code: agent.code }, data: { systemPrompt: 'CI operator-managed prompt' } }),
      db.promptTemplate.update({ where: { code: prompt.code }, data: { template: 'CI operator-managed template' } }),
      db.n8nWorkflow.update({ where: { code: workflow.code }, data: { description: 'CI operator-managed workflow' } }),
      db.aiMemory.update({ where: { id: memory.id }, data: { content: 'CI operator-managed memory' } }),
      db.blogPost.update({ where: { id: post.id }, data: { content: 'CI operator-managed article' } }),
      db.setting.update({ where: { key: setting.key }, data: { value: JSON.stringify('CI operator-managed setting') } }),
      db.user.update({ where: { id: admin.id }, data: { name: 'CI operator-managed Super Admin', mustChangePassword: false } }),
    ])

    // A second production-mode seed must neither reset the administrator nor
    // replace any operator-managed core record/settings/content.
    runSeed()

    const [afterCounts, afterAdmin, afterDepartment, afterAgent, afterPrompt, afterWorkflow, afterMemory, afterPost, afterSetting] = await Promise.all([
      recordCounts(),
      db.user.findUnique({ where: { email } }),
      db.department.findUnique({ where: { id: department.id } }),
      db.aiAgent.findUnique({ where: { code: agent.code } }),
      db.promptTemplate.findUnique({ where: { code: prompt.code } }),
      db.n8nWorkflow.findUnique({ where: { code: workflow.code } }),
      db.aiMemory.findUnique({ where: { id: memory.id } }),
      db.blogPost.findUnique({ where: { id: post.id } }),
      db.setting.findUnique({ where: { key: setting.key } }),
    ])

    if (JSON.stringify(afterCounts) !== JSON.stringify(initialCounts)) throw new Error('second seed changed core record counts')
    if (!afterAdmin
      || afterAdmin.role !== 'SUPER_ADMIN'
      || afterAdmin.name !== 'CI operator-managed Super Admin'
      || afterAdmin.mustChangePassword
      || afterAdmin.passwordHash !== originalPasswordHash) {
      throw new Error('second seed overwrote the existing Super Admin record')
    }
    if (afterDepartment?.name !== 'CI operator-managed department'
      || afterAgent?.systemPrompt !== 'CI operator-managed prompt'
      || afterPrompt?.template !== 'CI operator-managed template'
      || afterWorkflow?.description !== 'CI operator-managed workflow'
      || afterMemory?.content !== 'CI operator-managed memory'
      || afterPost?.content !== 'CI operator-managed article'
      || afterSetting?.value !== JSON.stringify('CI operator-managed setting')) {
      throw new Error('second seed overwrote operator-managed core data')
    }

    console.log('[seed-safety] production bootstrap is idempotent and preserves existing records')
  } catch {
    fail('production bootstrap or non-destructive idempotency check failed')
  } finally {
    await db.$disconnect()
  }
}

await main()
