/**
 * Standalone background worker process for production.
 *
 * Run with:  bun run scripts/worker.ts
 *
 * In production this runs as its own systemd unit (tech360-worker)
 * alongside the Next.js app. It imports the job-runner polling loop
 * and runs forever, draining the "jobs" queue.
 *
 * The Next.js app also calls ensureWorkerStarted() from
 * src/lib/job-runner.ts so a single-process dev sandbox still
 * processes jobs without needing a separate worker.
 */

import { ensureWorkerStarted } from "../src/lib/job-runner";
import { getQueueProvider } from "../src/lib/queue";

console.log(`[worker] starting — queue provider: ${getQueueProvider()}`);
console.log("[worker] polling queue 'jobs' every 2s. Ctrl+C to stop.");

ensureWorkerStarted();

// Keep the process alive.
process.on("SIGINT", () => {
  console.log("\n[worker] shutting down.");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("\n[worker] SIGTERM received, shutting down.");
  process.exit(0);
});

// Never resolve — the polling loop runs in the background.
setInterval(() => {
  /* keepalive */
}, 60_000);
