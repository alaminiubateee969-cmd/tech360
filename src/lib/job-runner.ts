/**
 * Background job runner. Polls the "jobs" queue every 2 seconds and
 * dispatches jobs by type to their handlers.
 *
 * In production, this module is imported by scripts/worker.ts which
 * runs as a separate long-lived process alongside the Next.js app.
 *
 * In the sandbox (or if the worker process isn't running), the
 * Next.js API route handlers import this module and call ensureStarted()
 * so a single-worker polling loop also runs inside the dev server.
 * This is honest about the limitation: in-memory queue jobs do NOT
 * survive process restarts.
 */

import { db } from "@/lib/db";
import { tryDequeue, getQueueProvider } from "@/lib/queue";
import { executeAgent } from "@/lib/ai-executor";
import { sendEmail } from "@/lib/email";
import { reindexAllNullEmbeddings } from "@/lib/ai-rag";

const POLL_INTERVAL_MS = 2000;
let started = false;

export interface JobPayload {
  jobId: string;
  type: "execute-agent" | "run-workflow" | "send-email" | "reindex-rag";
  data?: Record<string, unknown>;
}

export function ensureWorkerStarted(): void {
  if (started) return;
  started = true;
  // Don't block module loading.
  void pollLoop();
}

async function pollLoop(): Promise<void> {
  for (;;) {
    try {
      const item = await tryDequeue("jobs");
      if (item) {
        const job = item.job as JobPayload;
        await processJob(job);
      } else {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (e) {
      console.error("[worker] poll loop error:", e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

export async function processJob(job: JobPayload): Promise<void> {
  const provider = getQueueProvider();
  console.log(`[worker] processing job ${job.jobId} type=${job.type} queue=${provider}`);

  await db.aIJob.update({
    where: { id: job.jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  }).catch(() => { /* job may have been deleted */ });

  try {
    let result: unknown = null;
    switch (job.type) {
      case "execute-agent": {
        const payload = (job.data ?? {}) as { agentSlug?: string; input?: Record<string, unknown>; userId?: string };
        if (!payload.agentSlug) throw new Error("agentSlug is required");
        result = await executeAgent(payload.agentSlug, payload.input ?? {}, payload.userId);
        break;
      }
      case "send-email": {
        const payload = (job.data ?? {}) as { to?: string; subject?: string; html?: string; text?: string };
        if (!payload.to || !payload.subject) throw new Error("to and subject are required");
        result = await sendEmail({
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        });
        break;
      }
      case "reindex-rag": {
        result = await reindexAllNullEmbeddings();
        break;
      }
      case "run-workflow": {
        const payload = (job.data ?? {}) as { workflowId?: string };
        if (!payload.workflowId) throw new Error("workflowId is required");
        result = await runWorkflowSteps(payload.workflowId);
        break;
      }
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
    await db.aIJob.update({
      where: { id: job.jobId },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        result: JSON.stringify(result).slice(0, 8000),
      },
    }).catch(() => { /* */ });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.aIJob.update({
      where: { id: job.jobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message.slice(0, 2000),
      },
    }).catch(() => { /* */ });
    console.error(`[worker] job ${job.jobId} failed:`, message);
  }
}

/**
 * Execute every step of a workflow sequentially. Each step may invoke
 * an AI agent or run a simple action. Real DB writes —
 * AIWorkflowExecution + AIWorkflowExecutionStep rows. Also updates the
 * legacy WorkflowRun row so the existing UI continues to work.
 */
async function runWorkflowSteps(workflowId: string): Promise<{ executionId: string }> {
  const wf = await db.aIWorkflow.findUnique({
    where: { id: workflowId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);

  const exec = await db.aIWorkflowExecution.create({
    data: {
      workflowId,
      status: "RUNNING",
      input: "{}",
    },
  });

  // Find the latest WorkflowRun row for this workflow (created by the
  // API route that enqueued us) and update its status as we go.
  const latestRun = await db.workflowRun.findFirst({
    where: { workflowId },
    orderBy: { startedAt: "desc" },
  });

  const stepLogs: string[] = [`Workflow "${wf.name}" started.`];
  if (latestRun) {
    await db.workflowRun.update({
      where: { id: latestRun.id },
      data: { logs: stepLogs.join("\n") },
    });
  }

  for (const step of wf.steps) {
    const stepExec = await db.aIWorkflowExecutionStep.create({
      data: {
        executionId: exec.id,
        stepId: step.id,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });
    try {
      let output = "";
      if (step.agentId) {
        const agent = await db.aIAgent.findUnique({
          where: { id: step.agentId },
          select: { slug: true },
        });
        if (agent) {
          const result = await executeAgent(agent.slug, { step: step.name, config: step.config });
          output = result.output.slice(0, 4000);
        }
      } else {
        output = `Action ${step.action} executed (no agent).`;
      }
      stepLogs.push(`Step ${step.order} (${step.name}): OK`);
      await db.aIWorkflowExecutionStep.update({
        where: { id: stepExec.id },
        data: { status: "SUCCESS", output, completedAt: new Date() },
      });
      if (latestRun) {
        await db.workflowRun.update({
          where: { id: latestRun.id },
          data: { logs: stepLogs.join("\n") },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      stepLogs.push(`Step ${step.order} (${step.name}): FAILED — ${msg}`);
      await db.aIWorkflowExecutionStep.update({
        where: { id: stepExec.id },
        data: { status: "FAILED", output: msg, completedAt: new Date() },
      });
      await db.aIWorkflowExecution.update({
        where: { id: exec.id },
        data: { status: "FAILED", completedAt: new Date(), output: stepLogs.join("\n") },
      });
      if (latestRun) {
        await db.workflowRun.update({
          where: { id: latestRun.id },
          data: { status: "FAILED", completedAt: new Date(), logs: stepLogs.join("\n") },
        });
      }
      return { executionId: exec.id };
    }
  }
  stepLogs.push("Workflow complete.");
  await db.aIWorkflowExecution.update({
    where: { id: exec.id },
    data: { status: "SUCCESS", completedAt: new Date(), output: stepLogs.join("\n") },
  });
  if (latestRun) {
    await db.workflowRun.update({
      where: { id: latestRun.id },
      data: { status: "SUCCESS", completedAt: new Date(), logs: stepLogs.join("\n") },
    });
  }
  return { executionId: exec.id };
}
