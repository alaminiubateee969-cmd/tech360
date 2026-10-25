/** Conflict-marker CI gate: passes on a clean tree, fails on a
 *  planted marker, ignores docs (which may quote the syntax). */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const script = path.resolve(process.cwd(), 'scripts/check-conflict-markers.mjs')

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'cm-'))
  spawnSync('git', ['init', '-q'], { cwd: dir })
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  spawnSync('git', ['add', '-A'], { cwd: dir })
  return dir
}
const run = (dir: string) => spawnSync(process.execPath, [script, '--root', dir], { encoding: 'utf8' })

describe('conflict marker gate', () => {
  it('passes a clean tree', () => {
    const dir = fixture({ 'src/a.ts': 'export const a = 1\n' })
    const r = run(dir)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /passed/)
  })
  it('fails on unresolved markers in source and JSON', () => {
    const dir = fixture({
      'src/a.ts': 'const a = 1\n<<<<<<< HEAD\nconst b = 2\n=======\nconst b = 3\n>>>>>>> other\n',
      'package.json': '{\n<<<<<<< HEAD\n}\n',
    })
    const r = run(dir)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /src\/a\.ts/)
    assert.match(r.stderr, /package\.json/)
  })
  it('ignores markers quoted in documentation', () => {
    const dir = fixture({ 'docs/NOTE.md': 'Example:\n<<<<<<< HEAD\n', 'src/a.ts': 'export {}\n' })
    assert.equal(run(dir).status, 0)
  })
})
