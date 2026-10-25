#!/usr/bin/env node
// CI gate: fail if unresolved merge-conflict markers appear in
// tracked source/config files. Documentation and this script are
// excluded (they may legitimately quote marker syntax); test
// fixtures named *.fixture.* are excluded as well.
// Usage: node scripts/check-conflict-markers.mjs [--root DIR]
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const rootArg = process.argv.indexOf('--root')
const root = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : process.cwd()

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.prisma', '.css', '.yml', '.yaml', '.toml'])
const MARKER = /^(<{7}|={7}|>{7})(\s|$)/m

let files
try {
  files = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
} catch {
  console.error('check-conflict-markers: git ls-files failed (not a git worktree?)')
  process.exit(2)
}

const offenders = []
for (const file of files) {
  if (file.startsWith('docs/') || file.endsWith('.md')) continue
  if (file.includes('.fixture.')) continue
  if (!CODE_EXT.has(path.extname(file))) continue
  const full = path.join(root, file)
  if (!existsSync(full)) continue
  const text = readFileSync(full, 'utf8')
  // Only flag markers at line starts (real conflicts), not prose.
  for (const [i, line] of text.split('\n').entries()) {
    if (/^(<{7}|>{7})(\s|$)/.test(line) || line === '=======' ) {
      offenders.push(`${file}:${i + 1}: ${line.slice(0, 60)}`)
      break
    }
  }
}

if (offenders.length) {
  console.error('Unresolved merge-conflict markers found:')
  for (const o of offenders) console.error(`  ${o}`)
  process.exit(1)
}
console.log(`conflict-marker check passed (${files.length} tracked files scanned)`)
