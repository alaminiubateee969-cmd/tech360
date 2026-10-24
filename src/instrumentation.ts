type DriverState = { started: boolean; timer?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }

const globalForAiOps = globalThis as typeof globalThis & { __tech360AiOpsDriver?: DriverState }

/**
 * Hostinger-safe in-process driver. It is runtime-only, production-only and
 * guarded globally so Next.js module loading cannot create duplicate schedulers.
 * The database lease in ops-loop is the second line of defence across processes.
 */
export async function register(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return
  const driver = process.env.AI_OPS_DRIVER?.trim().toLowerCase()
  if (driver === 'off' || (driver && driver !== 'on')) return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return

  // Load the Node-only operations engine lazily. Importing it at module scope
  // made Next.js bundle `node:crypto`, Prisma and the ops modules into the Edge
  // instrumentation runtime, which produced avoidable "Node.js module is loaded
  // in the Edge Runtime" warnings on every dev server start. The driver itself
  // is Node-only, so the import belongs after the runtime guard.
  const [{ runOpsCycle }, { resolveOpsIntervalSec, withTimeout }] = await Promise.all([
    import('@/lib/ops-loop'),
    import('@/lib/agents/resilience'),
  ])

  const state = globalForAiOps.__tech360AiOpsDriver ?? { started: false }
  globalForAiOps.__tech360AiOpsDriver = state
  if (state.started) return
  state.started = true

  const intervalMs = resolveOpsIntervalSec() * 1000
  const run = async () => {
    try {
      await withTimeout(() => runOpsCycle('SERVICE'), 280_000)
    } catch (error) {
      // The cycle itself persists failures. This catch keeps an AI provider or
      // database outage from terminating the Next.js process or the timer.
      console.error('[tech360-ai-ops] cycle driver error', error instanceof Error ? error.message : String(error))
    }
  }

  state.timer = setTimeout(() => {
    void run()
    state.interval = setInterval(() => { void run() }, intervalMs)
  }, 30_000)
}
