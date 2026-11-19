/** Classify availability failures without parsing (or exposing) Prisma messages. */
const AVAILABILITY_CODES = new Set([
  'P1001', // Database server cannot be reached.
  'P1002', // Timed out reaching the database server.
  'P1008', // Database operation timed out.
  'P1017', // Server closed the connection.
  'P2024', // Connection-pool acquisition timed out.
  'P2037', // Database connection limit reached.
])

export function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, errorCode, name } = error as { code?: unknown; errorCode?: unknown; name?: unknown }
  if (typeof code === 'string' && AVAILABILITY_CODES.has(code)) return true
  if (typeof errorCode === 'string' && AVAILABILITY_CODES.has(errorCode)) return true

  // Some engine/driver initialization failures omit errorCode entirely. An
  // explicit non-availability code (e.g. schema/configuration errors) must
  // still be reported as an unexpected server failure, not a retryable outage.
  return name === 'PrismaClientInitializationError' && code == null && errorCode == null
}
