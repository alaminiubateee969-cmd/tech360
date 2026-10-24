/**
 * TECH360 — backup tooling tests.
 *
 * These tests exercise the REAL shell scripts in scripts/backup/ end to end:
 * locking, credential handling, integrity verification, retention pruning and
 * the restore-drill safety rails.
 *
 * IMPORTANT — what this does NOT prove
 * ------------------------------------
 * This suite replaces `mysqldump`, `mysql` and `mysqladmin` with stubs because
 * the test environment has no MySQL server. It therefore proves the WRAPPER
 * logic (arguments, secrets handling, file layout, checks, exit codes, safety
 * rails) and NOT that a real MySQL dump/restore works. A real backup and a real
 * restore drill must be run on the host and recorded separately — see
 * docs/BACKUP_AND_RESTORE.md and the honest status in
 * docs/FULL_PROJECT_CODE_AUDIT_2026-10-24.md.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname } from 'node:path'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const ROOT = join(__dirname, '..')
const BACKUP = join(ROOT, 'scripts', 'backup', 'mysql-backup.sh')
const DRILL = join(ROOT, 'scripts', 'backup', 'mysql-restore-drill.sh')
const SECRET = 'S3cr3t-Pa55word-Do-Not-Print'

function workdir(): string {
  return mkdtempSync(join(tmpdir(), 't360-backup-test-'))
}

/** A stand-in for mysqldump that produces a plausible, verifiable dump. */
function installDumpStub(bin: string, opts: { failCode?: number; empty?: boolean } = {}): void {
  const script = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${STUB_LOG:?}"
for a in "$@"; do
  case "$a" in
    --defaults-extra-file=*)
      cnf="\${a#--defaults-extra-file=}"
      # The password must arrive via the defaults file, never argv.
      [[ -f "$cnf" ]] || { echo "stub: defaults file missing" >&2; exit 9; }
      grep -q '^password=' "$cnf" || { echo "stub: no password in defaults file" >&2; exit 9; }
      ;;
  esac
done
if (( ${opts.failCode ?? 0} != 0 )); then
  echo "mysqldump: Got error: stub failure (${opts.failCode ?? 0})" >&2
  exit ${opts.failCode ?? 0}
fi
if [[ "${opts.empty ? '1' : '0'}" == "1" ]]; then exit 0; fi
cat <<'SQL'
-- MySQL dump 10.13  Distrib 8.0.39, for Linux (x86_64)
--
-- Table structure for table User
--
CREATE TABLE \`User\` (
  \`id\` varchar(191) NOT NULL,
  \`email\` varchar(191) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--
-- Table structure for table Client
--
CREATE TABLE \`Client\` (
  \`id\` varchar(191) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO \`User\` VALUES ('u1','demo@example.com');
-- Dump completed on 2026-10-24  9:00:00
SQL
`
  const file = join(bin, 'mysqldump')
  writeFileSync(file, script)
  chmodSync(file, 0o755)
}

/**
 * Stand-in for the mysql client used by the restore drill.
 *
 * It emulates just enough server state to exercise the drill: a schema
 * "exists" only after CREATE DATABASE and stops existing after DROP DATABASE
 * (tracked with marker files under STUB_STATE).
 */
function installMysqlStub(bin: string, opts: { tables?: number } = {}): void {
  const tables = opts.tables ?? 73
  const script = `#!/usr/bin/env bash
set -euo pipefail
printf 'MYSQL %s\\n' "$*" >> "\${STUB_LOG:?}"
state="\${STUB_STATE:?}"
mkdir -p "$state"
stmt=""
db=""
next_is_stmt=0
for a in "$@"; do
  case "$a" in
    -e) next_is_stmt=1 ;;
    --defaults-extra-file=*) ;;
    -*) ;;
    *) if [[ "$next_is_stmt" == "1" ]]; then stmt="$a"; next_is_stmt=0; else db="$a"; fi ;;
  esac
done
if [[ -n "$stmt" ]]; then
  case "$stmt" in
    *"DROP DATABASE"*|*"CREATE DATABASE"*)
      for name in $(printf '%s' "$stmt" | grep -o 'tech360_drill_[A-Za-z0-9_]*' | sort -u); do
        if printf '%s' "$stmt" | grep -q "CREATE DATABASE .$name."; then : > "$state/$name"
        elif printf '%s' "$stmt" | grep -q "DROP DATABASE"; then rm -f "$state/$name"
        fi
      done
      echo "" ;;
    *information_schema.tables*)
      name="$(printf '%s' "$stmt" | grep -o 'tech360_drill_[A-Za-z0-9_]*' | head -n1 || true)"
      if [[ -n "$name" ]]; then
        if [[ -f "$state/$name" ]]; then echo ${tables}; else echo 0; fi
      else
        echo ${tables}
      fi ;;
    *"SELECT COUNT(*) FROM "*)
      echo 12 ;;
    *"SELECT COUNT(*)"*) echo 1 ;;
    *INSERT*Setting*) echo "" ;;
    *) echo "" ;;
  esac
  exit 0
fi
# Load mode: consume the dump without printing anything.
cat > /dev/null
exit 0
`
  const file = join(bin, 'mysql')
  writeFileSync(file, script)
  chmodSync(file, 0o755)
}

function baseEnv(bin: string, log: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ''}`,
    STUB_LOG: log,
    STUB_STATE: join(dirname(log), 'state'),
    DATABASE_URL: `mysql://tech360:${SECRET}@db.hostinger.test:3306/tech360_prod`,
    ...extra,
  } as NodeJS.ProcessEnv
}

function run(script: string, args: string[], env: NodeJS.ProcessEnv) {
  const res = spawnSync('bash', [script, ...args], { env, encoding: 'utf8', timeout: 60_000 })
  return { code: res.status ?? -1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` }
}

describe('backup tooling — syntax and safety', () => {
  it('both scripts parse cleanly', () => {
    for (const script of [BACKUP, DRILL]) {
      const res = spawnSync('bash', ['-n', script], { encoding: 'utf8' })
      assert.equal(res.status, 0, `${script}: ${res.stderr}`)
    }
  })

  it('refuses a non-MySQL DATABASE_URL and creates nothing', () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin)
    const target = join(dir, 'backups')
    const { code, out } = run(BACKUP, [], baseEnv(bin, join(dir, 'stub.log'), {
      DATABASE_URL: 'postgresql://u:p@h:5432/db',
      TECH360_BACKUP_DIR: target,
    }))
    assert.equal(code, 2, out)
    assert.match(out, /must be a mysql:\/\/ URL/)
    assert.equal(existsSync(target), false, 'no backup directory may be created on a refused config')
    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses to write backups inside the web root', () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin)
    const { code, out } = run(BACKUP, [], baseEnv(bin, join(dir, 'stub.log'), {
      TECH360_BACKUP_DIR: join(dir, 'public', 'backups'),
    }))
    assert.equal(code, 2, out)
    assert.match(out, /refusing to store backups inside the web root/)
    rmSync(dir, { recursive: true, force: true })
  })

  it('a dry run reports the plan without dumping', () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin)
    const stubLog = join(dir, 'stub.log')
    const { code, out } = run(BACKUP, ['--dry-run'], baseEnv(bin, stubLog, {
      TECH360_BACKUP_DIR: join(dir, 'backups'),
    }))
    assert.equal(code, 0, out)
    assert.match(out, /DRY_RUN database=tech360_prod/)
    assert.equal(existsSync(stubLog), false, 'mysqldump must not run during a dry run')
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('backup tooling — a successful run', () => {
  it('writes a compressed dump, checksum and machine-readable status', () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin)
    const target = join(dir, 'backups')
    const { code, out } = run(BACKUP, [], baseEnv(bin, join(dir, 'stub.log'), { TECH360_BACKUP_DIR: target }))
    assert.equal(code, 0, out)

    const files = readdirSync(target)
    const dumpFile = files.find((f) => f.endsWith('.sql.gz'))
    assert.ok(dumpFile, `expected a .sql.gz artefact, saw ${files.join(', ')}`)
    assert.ok(files.includes(`${dumpFile}.sha256`), 'a checksum file must be written')
    assert.ok(files.includes('last-run.json'), 'a status record must be written')

    const status = JSON.parse(readFileSync(join(target, 'last-run.json'), 'utf8'))
    assert.equal(status.status, 'OK')
    assert.equal(status.database, 'tech360_prod')
    assert.equal(status.engine, 'mysqldump')
    assert.equal(status.consistency, 'single-transaction')
    assert.equal(status.tables, 2, 'the number of CREATE TABLE statements is recorded as evidence')
    assert.match(status.sha256, /^[0-9a-f]{64}$/)
    assert.ok(status.sizeBytes > 0)

    // The dump is intact and self-verifying.
    const verify = run(BACKUP, ['--verify-only', join(target, dumpFile)], baseEnv(bin, join(dir, 'stub.log'), {
      TECH360_BACKUP_DIR: target,
    }))
    assert.equal(verify.code, 0, verify.out)
    assert.match(verify.out, /VERIFY_OK/)

    // Directory and file permissions are restrictive.
    const dirMode = execFileSync('stat', ['-c', '%a', target], { encoding: 'utf8' }).trim()
    assert.equal(dirMode, '700')
    const fileMode = execFileSync('stat', ['-c', '%a', join(target, dumpFile)], { encoding: 'utf8' }).trim()
    assert.equal(fileMode, '600')
    rmSync(dir, { recursive: true, force: true })
  })

  it('never exposes the database password', () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin)
    const target = join(dir, 'backups')
    const stubLog = join(dir, 'stub.log')
    const { code, out } = run(BACKUP, [], baseEnv(bin, stubLog, { TECH360_BACKUP_DIR: target }))
    assert.equal(code, 0, out)
    assert.ok(!out.includes(SECRET), 'the password must never appear in stdout/stderr')
    const argv = readFileSync(stubLog, 'utf8')
    assert.ok(!argv.includes(SECRET), 'the password must never be passed as a command-line argument')
    assert.match(argv, /--defaults-extra-file=/, 'credentials must travel via a defaults file')
    for (const file of readdirSync(target)) {
      const content = readFileSync(join(target, file)).toString('binary')
      assert.ok(!content.includes(SECRET), `${file} must not contain the database password`)
    }
    // The temporary defaults file is removed on exit.
    const leftovers = execFileSync('bash', ['-lc', `ls ${tmpdir()}/tech360-mysql-* 2>/dev/null | wc -l`], { encoding: 'utf8' }).trim()
    assert.equal(leftovers, '0', 'the temporary credentials file must be deleted')
    rmSync(dir, { recursive: true, force: true })
  })

  it('records a failure with a non-zero exit code and no secret', () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin, { failCode: 2 })
    const target = join(dir, 'backups')
    const { code, out } = run(BACKUP, [], baseEnv(bin, join(dir, 'stub.log'), { TECH360_BACKUP_DIR: target }))
    assert.equal(code, 3, out)
    const status = JSON.parse(readFileSync(join(target, 'last-run.json'), 'utf8'))
    assert.equal(status.status, 'FAILED')
    assert.equal(status.code, 'DUMP_FAILED')
    assert.ok(!out.includes(SECRET))
    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects an empty dump instead of reporting success', () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin, { empty: true })
    const target = join(dir, 'backups')
    const { code, out } = run(BACKUP, [], baseEnv(bin, join(dir, 'stub.log'), { TECH360_BACKUP_DIR: target }))
    assert.equal(code, 3, out)
    const status = JSON.parse(readFileSync(join(target, 'last-run.json'), 'utf8'))
    assert.equal(status.code, 'DUMP_EMPTY')
    rmSync(dir, { recursive: true, force: true })
  })

  it('detects a corrupted backup during verification', () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin)
    const target = join(dir, 'backups')
    const env = baseEnv(bin, join(dir, 'stub.log'), { TECH360_BACKUP_DIR: target })
    assert.equal(run(BACKUP, [], env).code, 0)
    const dumpFile = readdirSync(target).find((f) => f.endsWith('.sql.gz'))!
    const full = join(target, dumpFile)
    const original = readFileSync(full)
    original[original.length - 10] ^= 0xff
    writeFileSync(full, original)
    const verify = run(BACKUP, ['--verify-only', full], env)
    assert.equal(verify.code, 4, verify.out)
    assert.match(verify.out, /VERIFY_FAILED/)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('backup tooling — overlap and retention', () => {
  it('a second concurrent run refuses to start (exit 75)', async () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    // A slow dump keeps the lock held while the second run starts.
    const slow = `#!/usr/bin/env bash
set -euo pipefail
sleep 5
cat <<'SQL'
-- Dump completed on 2026-10-24
SQL
`
    writeFileSync(join(bin, 'mysqldump'), slow)
    chmodSync(join(bin, 'mysqldump'), 0o755)
    const target = join(dir, 'backups')
    const env = baseEnv(bin, join(dir, 'stub.log'), { TECH360_BACKUP_DIR: target })

    const first = spawn('bash', [BACKUP], { env, stdio: 'ignore' })
    await new Promise((r) => setTimeout(r, 1200))
    const second = run(BACKUP, [], env)
    assert.equal(second.code, 75, second.out)
    assert.match(second.out, /SKIPPED_LOCKED/)
    first.kill()
    rmSync(dir, { recursive: true, force: true })
  })

  it('applies the retention policy and always keeps the newest backup', () => {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin)
    const target = join(dir, 'backups')
    execFileSync('mkdir', ['-p', target])
    // Two very old artefacts that fall outside every retention bucket.
    for (const name of ['tech360_prod-20240101T000000Z.sql.gz', 'tech360_prod-20250801T000000Z.sql.gz']) {
      writeFileSync(join(target, name), 'old')
      writeFileSync(join(target, `${name}.sha256`), 'x')
      const past = new Date('2024-01-01T00:00:00Z')
      utimesSync(join(target, name), past, past)
    }
    const { code, out } = run(BACKUP, [], baseEnv(bin, join(dir, 'stub.log'), {
      TECH360_BACKUP_DIR: target,
      TECH360_BACKUP_RETENTION_DAILY: '7',
      TECH360_BACKUP_RETENTION_WEEKLY: '4',
      TECH360_BACKUP_RETENTION_MONTHLY: '3',
    }))
    assert.equal(code, 0, out)
    const remaining = readdirSync(target).filter((f) => f.endsWith('.sql.gz'))
    assert.equal(remaining.length, 1, `expected only the new backup to survive, saw ${remaining.join(', ')}`)
    assert.ok(!remaining.includes('tech360_prod-20240101T000000Z.sql.gz'), 'expired backups must be pruned')
    const status = JSON.parse(readFileSync(join(target, 'last-run.json'), 'utf8'))
    assert.equal(status.retention.deleted, 2)
    assert.equal(status.retention.kept, 1)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('restore drill — isolated and non-destructive', () => {
  function prepare() {
    const dir = workdir()
    const bin = join(dir, 'bin')
    execFileSync('mkdir', ['-p', bin])
    installDumpStub(bin)
    installMysqlStub(bin)
    const target = join(dir, 'backups')
    const env = baseEnv(bin, join(dir, 'stub.log'), { TECH360_BACKUP_DIR: target })
    // Produce a real backup for the drill to consume.
    assert.equal(run(BACKUP, [], env).code, 0)
    return { dir, bin, target, env }
  }

  it('refuses a target database without the drill prefix', () => {
    const { dir, env } = prepare()
    const { code, out } = run(DRILL, ['--target-database', 'tech360_prod'], env)
    assert.equal(code, 2, out)
    assert.match(out, /must start with 'tech360_drill_'/)
    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses any target that matches the production database name', () => {
    const { dir, env } = prepare()
    // Prefix satisfied, but this is still the production database name.
    const { code, out } = run(DRILL, ['--target-database', 'tech360_drill_x'], { ...env, DATABASE_URL: 'mysql://u:p@h:3306/tech360_drill_x' })
    assert.equal(code, 2, out)
    assert.match(out, /equals the production database/)
    rmSync(dir, { recursive: true, force: true })
  })

  it('restores into the isolated database and records PASS evidence', () => {
    const { dir, target, env } = prepare()
    const stubLog = join(dir, 'stub.log')
    const { code, out } = run(DRILL, ['--target-database', 'tech360_drill_20261024'], env)
    assert.equal(code, 0, out)

    const evidence = JSON.parse(readFileSync(join(target, 'last-drill.json'), 'utf8'))
    assert.equal(evidence.status, 'PASS')
    assert.equal(evidence.targetDatabase, 'tech360_drill_20261024')
    assert.ok(evidence.sourceTables > 0)
    assert.equal(evidence.sourceTables, evidence.restoredTables)
    assert.match(evidence.sha256, /^[0-9a-f]{64}$/)

    const calls = readFileSync(stubLog, 'utf8')
    // The only DROP/CREATE statements may target the drill database.
    const destructive = calls.split('\n').filter((l) => /DROP DATABASE|CREATE DATABASE/.test(l))
    assert.ok(destructive.length > 0, 'the drill must create its scratch database')
    for (const line of destructive) {
      assert.ok(!line.includes('tech360_prod'), `destructive statement touched production: ${line}`)
      assert.match(line, /tech360_drill_/)
    }
    rmSync(dir, { recursive: true, force: true })
  })

  it('fails verification on a corrupted dump without touching the source', () => {
    const { dir, target, env } = prepare()
    const dumpFile = readdirSync(target).find((f) => f.endsWith('.sql.gz'))!
    const full = join(target, dumpFile)
    const bytes = readFileSync(full)
    bytes[bytes.length - 5] ^= 0xff
    writeFileSync(full, bytes)
    const { code, out } = run(DRILL, ['--target-database', 'tech360_drill_bad', '--dump', full], env)
    assert.equal(code, 4, out)
    assert.match(out, /sha256 mismatch|gzip integrity/)
    rmSync(dir, { recursive: true, force: true })
  })
})
