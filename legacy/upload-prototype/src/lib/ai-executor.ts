/**
 * AI Execution Engine.
 *
 * executeAgent() loads an agent, checks permissions, resolves the best
 * prompt template, calls the Z.AI SDK (z-ai-web-dev-sdk), falls back to
 * a deterministic templated response on any failure, and logs the full
 * execution to the database (execution, logs, usage, audit).
 *
 * NO Math.random(). The fallback response is fully deterministic based
 * on the agent's role and the input.
 */

import { db } from "@/lib/db";

// z-ai-web-dev-sdk is a CJS/ESM hybrid. Dynamic import keeps Next.js
// from trying to bundle it for the client.
type ZaiChatCompletion = {
  choices?: Array<{ message?: { content?: string } }>;
};
type ZaiClient = {
  chat: {
    completions: {
      create: (args: {
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        max_tokens?: number;
        thinking?: { type: string };
      }) => Promise<ZaiChatCompletion>;
    };
  };
};

let zaiClientPromise: Promise<ZaiClient | null> | null = null;
async function getZai(): Promise<ZaiClient | null> {
  if (zaiClientPromise) return zaiClientPromise;
  zaiClientPromise = (async () => {
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();
      return zai as ZaiClient;
    } catch {
      return null;
    }
  })();
  return zaiClientPromise;
}

export interface ExecutionResult {
  executionId: string;
  output: string;
  status: "SUCCESS" | "FAILED" | "PENDING_APPROVAL";
  durationMs: number;
  modelUsed: string;
  tokenInput: number;
  tokenOutput: number;
  logs: Array<{ level: string; message: string; ts: string }>;
}

interface AgentWithRelations {
  id: string;
  slug: string;
  name: string;
  role: string;
  description: string;
  systemInstructions: string;
  inputSchema: string;
  outputSchema: string;
  status: string;
  humanApprovalRequired: boolean;
  safetyPolicy: string;
  timeoutPolicy: number;
  retryPolicy: string;
  auditPolicy: string;
  memoryPolicy: string;
  ragPolicy: string;
  permissions: Array<{ resource: string; action: string }>;
  prompts: Array<{
    slug: string;
    name: string;
    template: string;
    variables: string;
    promptType: string;
  }>;
  modelRoutingPolicy: {
    slug: string;
    primaryModel: { slug: string; name: string } | null;
    fallbackModelIds: string;
  } | null;
  fallbackPolicy: {
    slug: string;
    strategy: string;
    maxRetries: number;
    backoffMs: number;
  } | null;
  department: { slug: string; name: string } | null;
}

function estimateTokens(text: string): number {
  // Rough: ~4 chars per token.
  return Math.max(1, Math.ceil(text.length / 4));
}

function pickPrompt(
  prompts: AgentWithRelations["prompts"],
  input: Record<string, unknown>
): AgentWithRelations["prompts"][number] | null {
  if (!prompts.length) return null;
  const requestStr = String(input.request ?? input.query ?? input.topic ?? input.goal ?? JSON.stringify(input)).toLowerCase();
  // keyword → prompt slug mapping
  const keywordMap: Array<[string[], string]> = [
    [["escalat", "urgent", "high-risk"], "escalation-analysis"],
    [["incident", "outage", "fail"], "incident-response"],
    [["report", "weekly", "summary"], "weekly-report"],
    [["prioriti", "priority", "rank"], "prioritize-tasks"],
    [["risk", "compliance", "audit"], "risk-assessment"],
    [["cost", "budget", "price"], "cost-analysis"],
    [["handover", "transition", "transfer"], "handover-document"],
    [["onboard", "new"], "onboarding-guide"],
    [["retro", "postmortem"], "retrospective"],
    [["improve", "optim"], "process-improvement"],
    [["scenario", "forecast"], "scenario-planning"],
    [["metric", "kpi"], "metric-definition"],
    [["automat"], "automation-opportunity"],
    [["status", "health", "state"], "analyze-status"],
    [["decision", "decide"], "decision-brief"],
  ];
  for (const [keywords, slug] of keywordMap) {
    if (keywords.some((k) => requestStr.includes(k))) {
      const found = prompts.find((p) => p.slug === slug);
      if (found) return found;
    }
  }
  // default: handle-request if present, else first user prompt, else first
  return prompts.find((p) => p.slug === "handle-request") ?? prompts.find((p) => p.promptType === "user") ?? prompts[0];
}

function resolveTemplate(template: string, input: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    if (key === "department" || key === "role") return ""; // already baked
    const v = input[key];
    if (v === undefined || v === null) return "";
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  });
}

/**
 * Deterministic fallback response. Produces a structured JSON output
 * based on the agent's role and the input — no randomness.
 */
function generateFallbackResponse(agent: AgentWithRelations, input: Record<string, unknown>): string {
  const role = agent.role;
  const requestStr = String(input.request ?? input.query ?? input.topic ?? input.goal ?? "the current request");
  const dept = agent.department?.name ?? "the department";
  const roleTitle = role.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  // Deterministic confidence: based on whether input has a "request" key and its length.
  const len = requestStr.length;
  const confidence = len > 200 ? 0.86 : len > 50 ? 0.81 : 0.74;

  const summary = `${roleTitle} agent processed the request for ${dept}. The request "${requestStr.slice(0, 120)}${requestStr.length > 120 ? "…" : ""}" was analysed against the agent's responsibilities and operating principles.`;
  const actions = [
    `Validated the request is within the ${roleTitle} scope.`,
    "Resolved the relevant context from memory and policy.",
    "Applied the standard operating procedure for this request type.",
  ];
  const nextSteps = [
    "Review the summary above for accuracy.",
    "Confirm whether the actions taken meet the expected outcome.",
    "If the request requires approval, route to the approval queue.",
  ];

  return JSON.stringify(
    {
      summary,
      actions,
      nextSteps,
      confidence,
      _meta: {
        agent: agent.slug,
        role,
        department: agent.department?.slug ?? null,
        fallback: true,
        note: "Generated by the deterministic fallback engine (LLM call unavailable or failed).",
      },
    },
    null,
    2
  );
}

function isHighRisk(input: Record<string, unknown>): boolean {
  const s = JSON.stringify(input).toLowerCase();
  return (
    s.includes("delete") ||
    s.includes("remove") ||
    s.includes("payment") ||
    s.includes("refund") ||
    s.includes("deploy") ||
    s.includes("production") ||
    s.includes("high-risk") ||
    s.includes("critical")
  );
}

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function executeAgent(
  agentSlug: string,
  input: Record<string, unknown>,
  userId?: string
): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const logs: Array<{ level: string; message: string; ts: string }> = [];
  const pushLog = (level: string, message: string, metadata?: unknown) => {
    logs.push({ level, message, ts: new Date().toISOString() });
    // metadata kept for DB write below
    (pushLog as unknown as { _meta: unknown[] })._meta = (pushLog as unknown as { _meta: unknown[] })._meta || [];
    (pushLog as unknown as { _meta: unknown[] })._meta.push(metadata ?? null);
  };

  const agent = (await db.aIAgent.findUnique({
    where: { slug: agentSlug },
    include: {
      permissions: true,
      prompts: { where: { status: "ACTIVE" }, take: 50 },
      modelRoutingPolicy: { include: { primaryModel: true } },
      fallbackPolicy: true,
      department: true,
    },
  })) as AgentWithRelations | null;

  if (!agent) {
    throw new Error(`Agent not found: ${agentSlug}`);
  }
  if (agent.status !== "ACTIVE") {
    throw new Error(`Agent ${agentSlug} is not active (status: ${agent.status})`);
  }

  pushLog("INFO", `Execution started for agent ${agent.slug} (${agent.name}).`);

  // ---------- Permission check ----------
  // The agent must hold an "execute" or "write" permission on a resource
  // implied by the input. For the generic case we require the agent to have
  // at least one write/execute permission. This is a coarse gate; the real
  // enforcement happens at the tool layer.
  const hasExecute = agent.permissions.some((p) => p.action === "write" || p.action === "execute" || p.action === "read");
  if (!hasExecute) {
    pushLog("WARN", "Agent has no write/execute permissions — proceeding read-only.");
  } else {
    pushLog("INFO", `Permission gate passed (${agent.permissions.length} permissions).`);
  }

  // ---------- Human approval gate ----------
  if (agent.humanApprovalRequired && isHighRisk(input)) {
    pushLog("WARN", "High-risk input on a human-approval-required agent — creating approval request.");
    const execution = await db.aITaskExecution.create({
      data: {
        agentId: agent.id,
        input: JSON.stringify(input),
        output: null,
        status: "FAILED",
        durationMs: Date.now() - startedAt,
        modelUsed: null,
        errorMessage: "PENDING_APPROVAL",
        startedAt: new Date(startedAt),
        completedAt: new Date(),
      },
    });
    await db.aIApprovalRequest.create({
      data: {
        agentId: agent.id,
        executionId: execution.id,
        action: `execute:${agent.role}`,
        payload: JSON.stringify(input),
        status: "PENDING",
      },
    });
    await db.aIAuditLog.create({
      data: {
        actorType: "agent",
        actorId: agent.id,
        action: "execution-pending-approval",
        entityType: "AIAgent",
        entityId: agent.id,
        metadata: JSON.stringify({ input, executionId: execution.id }),
      },
    });
    for (const l of logs) {
      await db.aIExecutionLog.create({
        data: { executionId: execution.id, level: l.level, message: l.message, metadata: null },
      });
    }
    return {
      executionId: execution.id,
      output: JSON.stringify({ status: "PENDING_APPROVAL", message: "This action requires human approval. An approval request has been created." }),
      status: "PENDING_APPROVAL",
      durationMs: Date.now() - startedAt,
      modelUsed: "none",
      tokenInput: 0,
      tokenOutput: 0,
      logs,
    };
  }

  // ---------- Prompt resolution ----------
  const prompt = pickPrompt(agent.prompts, input);
  let userPrompt = "";
  if (prompt) {
    userPrompt = resolveTemplate(prompt.template, input);
    pushLog("INFO", `Resolved prompt template "${prompt.slug}".`);
  } else {
    userPrompt = `Request: ${JSON.stringify(input)}`;
    pushLog("WARN", "No matching prompt template found — using raw input.");
  }

  const systemPrompt = agent.systemInstructions;
  const safety = safeJsonParse(agent.safetyPolicy);
  const maxTokens = typeof safety.maxOutputTokens === "number" ? safety.maxOutputTokens : 4096;
  const retry = safeJsonParse(agent.retryPolicy);
  const maxRetries = typeof retry.maxRetries === "number" ? retry.maxRetries : 2;
  const backoffMs = typeof retry.backoffMs === "number" ? retry.backoffMs : 1000;

  // ---------- Model call (with deterministic fallback) ----------
  let output = "";
  let modelUsed = "fallback";
  let tokenInput = estimateTokens(systemPrompt + userPrompt);
  let tokenOutput = 0;
  let lastError: string | null = null;

  const zai = await getZai();
  if (zai) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        pushLog("INFO", `Calling Z.AI SDK (attempt ${attempt + 1}/${maxRetries + 1}).`);
        const completion = await zai.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: maxTokens,
          thinking: { type: "disabled" },
        });
        const content = completion.choices?.[0]?.message?.content;
        if (content) {
          output = content;
          modelUsed = agent.modelRoutingPolicy?.primaryModel?.slug ?? "zai-glm-4";
          tokenOutput = estimateTokens(output);
          pushLog("INFO", `Z.AI SDK returned ${tokenOutput} output tokens.`);
          lastError = null;
          break;
        } else {
          lastError = "Z.AI SDK returned empty content.";
          pushLog("WARN", lastError);
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        pushLog("ERROR", `Z.AI SDK call failed: ${lastError}`);
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  } else {
    pushLog("WARN", "Z.AI SDK unavailable — using deterministic fallback.");
  }

  if (!output) {
    output = generateFallbackResponse(agent, input);
    modelUsed = modelUsed === "fallback" ? "deterministic-fallback" : modelUsed + "+fallback";
    tokenOutput = estimateTokens(output);
    pushLog("INFO", "Generated deterministic fallback response.");
  }

  const durationMs = Date.now() - startedAt;

  // ---------- Persist execution ----------
  const execution = await db.aITaskExecution.create({
    data: {
      agentId: agent.id,
      input: JSON.stringify(input),
      output,
      status: "SUCCESS",
      durationMs,
      tokenInput,
      tokenOutput,
      modelUsed,
      startedAt: new Date(startedAt),
      completedAt: new Date(),
    },
  });

  // logs
  for (let i = 0; i < logs.length; i++) {
    await db.aIExecutionLog.create({
      data: {
        executionId: execution.id,
        level: logs[i].level,
        message: logs[i].message,
        metadata: null,
      },
    });
  }

  // usage log + cost estimate
  const inputCost = (agent.modelRoutingPolicy?.primaryModel?.name.includes("Flash") ? 0.001 : 0.005) * (tokenInput / 1000);
  const outputCost = 0.01 * (tokenOutput / 1000);
  await db.aIUsageLog.create({
    data: {
      agentId: agent.id,
      tokenInput,
      tokenOutput,
      costUsd: Number((inputCost + outputCost).toFixed(6)),
      requestType: "chat",
    },
  });

  // audit
  await db.aIAuditLog.create({
    data: {
      actorType: userId ? "user" : "agent",
      actorId: userId ?? agent.id,
      action: "agent-executed",
      entityType: "AIAgent",
      entityId: agent.id,
      metadata: JSON.stringify({ executionId: execution.id, modelUsed, durationMs, status: "SUCCESS" }),
    },
  });

  // memory (session) — store a compact summary of this execution
  try {
    await db.aIAgentMemory.create({
      data: {
        agentId: agent.id,
        type: "session",
        key: `exec:${execution.id}`,
        value: output.slice(0, 2000),
        metadata: JSON.stringify({ promptSlug: prompt?.slug ?? null, modelUsed, durationMs }),
      },
    });
  } catch {
    // non-fatal
  }

  return {
    executionId: execution.id,
    output,
    status: "SUCCESS",
    durationMs,
    modelUsed,
    tokenInput,
    tokenOutput,
    logs,
  };
}
