import { createHash } from 'node:crypto'

/**
 * A review packet, NOT a patch parser, sandbox, approval or permission to apply.
 * This function never reads files, writes files, executes code or verifies claims.
 */
export function createEvolutionReviewPacket(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an object')
  const value = input as Record<string, unknown>
  if (Object.keys(value).some((key) => !['baseCommit', 'proposal', 'patch'].includes(key))) throw new Error('Unsupported field')
  if (typeof value.baseCommit !== 'string' || !/^[0-9a-f]{40}$/.test(value.baseCommit)) throw new Error('baseCommit must be a full lowercase 40-character Git commit hash')
  if (typeof value.proposal !== 'string' || value.proposal.trim().length < 10 || value.proposal.length > 2000) throw new Error('proposal must contain 10–2000 characters')
  if (typeof value.patch !== 'string' || !value.patch.trim() || Buffer.byteLength(value.patch, 'utf8') > 48_000) throw new Error('patch must be non-empty and at most 48000 bytes')
  const digest = createHash('sha256').update(value.patch, 'utf8').digest('hex')
  return {
    baseCommit: value.baseCommit,
    patchSha256: digest,
    patchBytes: Buffer.byteLength(value.patch, 'utf8'),
    status: 'REVIEW_ONLY' as const,
    executable: false,
    requirements: [
      'Verify the authorized repository and base commit independently.',
      'Review patch paths, symlinks, scope and sensitive data independently.',
      'Test in an independently isolated environment with no production credentials.',
      'Require authenticated human review and separate merge and release approval.',
    ],
  }
}
