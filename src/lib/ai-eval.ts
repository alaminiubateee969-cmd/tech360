/**
 * Evaluation, feedback, and incident helpers.
 *
 * runEvaluation() creates an AIEvaluationRun, executes the agent with
 * the test inputs from its AIAgentTest rows, computes metrics (latency,
 * success rate, hallucination flag via output validation), and persists
 * the results.
 *
 * submitFeedback() and reportIncident() are thin persistence wrappers.
 */

import { db } from "@/lib/db";
import { executeAgent } from "@/lib/ai-executor";

interface MetricResult {
  name: string;
  value: number;
  unit: string;
  target?: number;
}

export async function runEvaluation(evaluationId: string): Promise<{
  runId: string;
  results: {
    metrics: MetricResult[];
    testsRun: number;
    successes: number;
    failures: number;
    avgLatencyMs: number;
    hallucinationFlags: number;
  };
}> {
  const evaluation = await db.aIEvaluation.findUnique({
    where: { id: evaluationId },
    include: {
      agent: true,
      metrics: true,
    },
  });
  if (!evaluation) throw new Error(`Evaluation not found: ${evaluationId}`);

  const run = await db.aIEvaluationRun.create({
    data: {
      evaluationId,
      status: "RUNNING",
    },
  });

  // Load the agent's tests.
  const tests = await db.aIAgentTest.findMany({
    where: { agentId: evaluation.agentId },
    take: 5,
  });

  let successes = 0;
  let failures = 0;
  let totalLatency = 0;
  let hallucinationFlags = 0;
  const perTestResults: Array<{ test: string; status: string; latency: number; hallucination: boolean }> = [];

  for (const test of tests) {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(test.input) as Record<string, unknown>;
    } catch {
      input = { request: test.input };
    }
    try {
      const result = await executeAgent(evaluation.agent.slug, input, "evaluation-runner");
      totalLatency += result.durationMs;
      const ok = result.status === "SUCCESS";
      if (ok) successes++;
      else failures++;
      // Hallucination heuristic: output must contain valid JSON with a "summary" key.
      let hallucination = false;
      try {
        const parsed = JSON.parse(result.output) as Record<string, unknown>;
        if (typeof parsed.summary !== "string" || parsed.summary.length < 10) hallucination = true;
      } catch {
        hallucination = true;
      }
      if (hallucination) hallucinationFlags++;
      perTestResults.push({ test: test.name, status: result.status, latency: result.durationMs, hallucination });
    } catch (e) {
      failures++;
      perTestResults.push({
        test: test.name,
        status: "FAILED",
        latency: 0,
        hallucination: false,
      });
    }
  }

  const testsRun = tests.length;
  const avgLatencyMs = testsRun ? Math.round(totalLatency / testsRun) : 0;
  const successRate = testsRun ? successes / testsRun : 0;
  const hallucinationRate = testsRun ? hallucinationFlags / testsRun : 0;

  const metrics: MetricResult[] = [
    { name: "accuracy", value: Number(successRate.toFixed(3)), unit: "ratio", target: 0.9 },
    { name: "latency-ms", value: avgLatencyMs, unit: "ms", target: 2000 },
    { name: "hallucination-rate", value: Number(hallucinationRate.toFixed(3)), unit: "ratio", target: 0.05 },
    { name: "success-count", value: successes, unit: "count" },
  ];

  // Update metric values on the evaluation.
  for (const m of metrics) {
    const existing = evaluation.metrics.find((em) => em.name === m.name);
    if (existing) {
      await db.aIEvaluationMetric.update({
        where: { id: existing.id },
        data: { value: m.value, target: m.target ?? existing.target },
      });
    }
  }

  await db.aIEvaluationRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      results: JSON.stringify({ metrics, perTestResults, testsRun, successes, failures }),
    },
  });

  await db.aIEvaluation.update({
    where: { id: evaluationId },
    data: { status: "COMPLETED" },
  });

  await db.aIAuditLog.create({
    data: {
      actorType: "system",
      action: "evaluation-run",
      entityType: "AIEvaluation",
      entityId: evaluationId,
      metadata: JSON.stringify({ runId: run.id, testsRun, successes, failures, avgLatencyMs }),
    },
  });

  return {
    runId: run.id,
    results: {
      metrics,
      testsRun,
      successes,
      failures,
      avgLatencyMs,
      hallucinationFlags,
    },
  };
}

export async function submitFeedback(
  agentId: string,
  executionId: string | null,
  rating: number,
  comment: string | null,
  submittedBy?: string
): Promise<{ feedbackId: string }> {
  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5.");
  const feedback = await db.aIAgentFeedback.create({
    data: { agentId, executionId, rating, comment, submittedBy },
  });
  await db.aIAuditLog.create({
    data: {
      actorType: "user",
      actorId: submittedBy ?? null,
      action: "feedback-submitted",
      entityType: "AIAgent",
      entityId: agentId,
      metadata: JSON.stringify({ rating, executionId }),
    },
  });
  return { feedbackId: feedback.id };
}

export async function reportIncident(
  agentId: string,
  severity: "low" | "medium" | "high" | "critical",
  type: string,
  description: string
): Promise<{ incidentId: string }> {
  const incident = await db.aIAgentIncident.create({
    data: { agentId, severity, type, description, status: "OPEN" },
  });
  await db.aIAuditLog.create({
    data: {
      actorType: "system",
      action: "incident-reported",
      entityType: "AIAgent",
      entityId: agentId,
      metadata: JSON.stringify({ incidentId: incident.id, severity, type }),
    },
  });
  return { incidentId: incident.id };
}

export async function resolveIncident(incidentId: string): Promise<void> {
  await db.aIAgentIncident.update({
    where: { id: incidentId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}
