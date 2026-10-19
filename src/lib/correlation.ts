import { randomBytes } from 'crypto'

/**
 * Correlation id generator.
 *
 * Kept in its own dependency-free module so security-critical code that
 * must not pull in the Prisma client (the model gateway, the skill
 * executor) can still produce correlated identifiers.
 */
export function newCorrelationId(): string {
  return randomBytes(12).toString('hex')
}
