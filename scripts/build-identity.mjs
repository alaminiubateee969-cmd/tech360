import { execFileSync } from 'node:child_process'

/** Capture public source metadata at build time, never runtime credentials.
 * Git is preferred over an environment override. Archive builds may supply a
 * full TECH360_BUILD_SHA, but cannot certify whether their source is clean.
 * A SHA is traceability metadata, not a signed deployment attestation.
 * @param {{ cwd?: string, env?: Record<string, string | undefined> }} options
 */
export function resolveBuildIdentity({ cwd = process.cwd(), env = process.env } = {}) {
  const validSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value.trim())
  const git = args => execFileSync('git', args, {
    cwd, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
  try {
    const commit = git(['rev-parse', 'HEAD'])
    if (validSha(commit)) {
      const status = git(['status', '--porcelain', '--untracked-files=normal'])
      return { commit: commit.toLowerCase(), sourceState: status ? 'dirty' : 'clean' }
    }
  } catch { /* A standalone source archive may not contain .git. */ }
  const supplied = env.TECH360_BUILD_SHA
  return {
    commit: validSha(supplied) ? supplied.trim().toLowerCase() : 'unknown',
    sourceState: 'unknown',
  }
}
