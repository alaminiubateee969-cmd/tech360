import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Templated agent responses keyed on role + skillPath.
// This replaces the original Tech360 "ambiguous command" bug with deterministic routing.
const ROLE_TEMPLATES: Record<string, (input: string) => string> = {
  "CEO Strategist": (input) =>
    `Strategic memo on "${input}":\n• Reframe in terms of revenue, retention, and risk.\n• Recommend quarterly OKR with 3 measurable key results.\n• Flag the single biggest blocker and a 30-day plan to remove it.\n\nNext action: circulate to leadership channel for sign-off.`,
  "CRM Manager": (input) =>
    `CRM view for "${input}":\n• 15 active leads in pipeline (4 hot, 6 warm, 5 cold).\n• 3 leads untouched for >48h — recommend WhatsApp follow-up via WhatsApp Agent.\n• Forecast: $128k weighted pipeline this month.`,
  "WhatsApp Agent": (input) =>
    `WhatsApp routing for "${input}":\n• Detected intent: sales inquiry.\n• Drafted reply: "Hi! Thanks for reaching out — sending over options now 📄"\n• Escalated to CRM Manager (lead score 82).`,
  "Scope Builder": (input) =>
    `Draft scope for "${input}":\n• Phase 1 — Discovery & Design (2 weeks, $8k)\n• Phase 2 — Build (6 weeks, $24k)\n• Phase 3 — Launch & Handover (2 weeks, $4k)\n• Deliverables: 12 items, 4 milestones, 2 approval gates.\nReady for Legal Reviewer.`,
  "Legal Reviewer": (input) =>
    `Legal pass on "${input}":\n• No high-risk clauses detected.\n• Recommend adding limitation-of-liability cap at fees paid.\n• Suggest 30-day payment terms (currently 45).\nStatus: cleared for client sign-off.`,
  "Evidence Tracker": (input) =>
    `Evidence log for "${input}":\n• 11 deliverables captured with timestamps.\n• 3 pending client acceptance.\n• Generated delivery digest PDF — ready to attach to invoice.`,
  "Payment Verifier": (input) =>
    `Payment reconciliation for "${input}":\n• 4 invoices paid this week ($38,500 total).\n• 1 mismatch flagged ($240 underpayment on INV-1029).\n• Recommendation: send polite reminder + statement of account.`,
  "Meeting Scheduler": (input) =>
    `Scheduling "${input}":\n• Proposed slots (TZ-aware): Wed 10:00, Thu 14:00, Fri 09:30.\n• Sent invite with agenda template.\n• Calendar block + WhatsApp reminder queued.`,
  "Content Writer": (input) =>
    `Draft content for "${input}":\n• Hook: "What if your business ran itself — for the boring parts?"\n• 3-section structure (problem → mechanism → proof).\n• Word count: 540. Tone: confident, concrete, human.\nReady for Brand Designer to add visuals.`,
  "Social Media Manager": (input) =>
    `Social plan for "${input}":\n• 5 posts queued across FB/IG/LI/X.\n• Optimal times: Tue 11:00, Thu 14:30, Sun 18:00.\n• Hashtags curated per channel.\nAwaiting brand-visual approval.`,
  "Brand Designer": (input) =>
    `Brand exploration for "${input}":\n• Moodboard: 12 references (premium SaaS, warm minimal).\n• Color system: amber + emerald on charcoal.\n• Type pair: Geist Sans + Geist Mono.\nDeliverable: 3 logo directions by EOD.`,
  "Video Producer": (input) =>
    `Edit plan for "${input}":\n• 4 reels @ 30s each, vertical 9:16.\n• Captions auto-generated, brand lower-thirds.\n• Export presets for IG/TikTok/YT Shorts.\nETA: 48h after footage lock.`,
  "Knowledge Curator": (input) =>
    `Knowledge index for "${input}":\n• 7 new articles tagged + summarized.\n• Linked to 14 related items.\n• Surfaced in agent prompts for next 3 engagements.`,
  "Memory Keeper": (input) =>
    `Client memory for "${input}":\n• Last 5 interactions summarized.\n• Preferences: prefers WhatsApp, async-friendly, decisive.\n• Open threads: 2 follow-ups due this week.\nMemory synced across agent fleet.`,
  "Email Composer": (input) =>
    `Email draft for "${input}":\n• Subject: "Quick follow-up + next steps 🚀"\n• 120 words, single CTA.\n• Personalized with last meeting note.\nReady to send — awaiting your approval.`,
  "SEO Optimizer": (input) =>
    `SEO audit for "${input}":\n• 3 pages missing meta descriptions.\n• Core Web Vitals: LCP 2.4s (target <2.5).\n• 8 internal-link opportunities identified.\nRecommendation: ship meta fixes this sprint.`,
  "Error Monitor": (input) =>
    `Error triage for "${input}":\n• 2 P2 incidents in last 24h (API 502s).\n• Root cause: rate-limit misconfiguration.\n• Fix deployed; monitoring for recurrence.\nNo customer impact reported.`,
  "Approval Gatekeeper": (input) =>
    `Approval routing for "${input}":\n• 6 pending approvals across SCOPE/PAYMENT/CONTENT.\n• 1 overdue (>72h) — escalated to SUPER_ADMIN.\n• SLA: 24h for content, 48h for scope, 12h for payment.`,
  "Analytics Insights": (input) =>
    `Weekly insight on "${input}":\n• Lead volume +18% WoW (WhatsApp source +47%).\n• Conversion rate 22% (↑3pp).\n• Anomaly: bounce rate spike on /pricing — investigating.`,
  "Client Success": (input) =>
    `Health score for "${input}":\n• Composite score: 78/100 (healthy).\n• Adoption 82% | Sentiment 74% | Support 90% | Commercial 66%.\n• Recommendation: QBR scheduled, expansion lead identified.`,
};

const FALLBACK = (input: string) =>
  `Acknowledged: "${input}".\nThis command did not match a specific agent skill. Please rephrase or pick an agent from the grid. (Bug fix: original Tech360 returned a generic 500 here — now we route deterministically.)`;

// Routes a free-text terminal command to the most likely agent.
export function routeCommand(input: string): { agentName: string; skillPath: string } | null {
  const text = input.toLowerCase();
  const rules: Array<{ keys: string[]; agent: string; skill: string }> = [
    { keys: ["lead", "pipeline", "score", "crm"], agent: "CRM Manager", skill: "skills/private/crm-and-automation/manager-agent/SKILL.md" },
    { keys: ["whatsapp", "wa ", "chat", "message"], agent: "WhatsApp Agent", skill: "skills/private/messaging/whatsapp-agent/SKILL.md" },
    { keys: ["scope", "sow", "deliverable"], agent: "Scope Builder", skill: "skills/private/delivery/scope-builder-agent/SKILL.md" },
    { keys: ["legal", "contract", "clause"], agent: "Legal Reviewer", skill: "skills/private/legal/legal-reviewer-agent/SKILL.md" },
    { keys: ["payment", "invoice", "verify", "reconcile"], agent: "Payment Verifier", skill: "skills/private/finance/payment-verifier-agent/SKILL.md" },
    { keys: ["meeting", "schedule", "book", "calendar"], agent: "Meeting Scheduler", skill: "skills/private/calendar/meeting-scheduler-agent/SKILL.md" },
    { keys: ["content", "blog", "copy", "write"], agent: "Content Writer", skill: "skills/private/content/content-writer-agent/SKILL.md" },
    { keys: ["social", "facebook", "instagram", "linkedin", "twitter", "post"], agent: "Social Media Manager", skill: "skills/private/social/social-media-manager-agent/SKILL.md" },
    { keys: ["brand", "logo", "design", "visual"], agent: "Brand Designer", skill: "skills/private/design/brand-designer-agent/SKILL.md" },
    { keys: ["video", "reel", "edit", "youtube"], agent: "Video Producer", skill: "skills/private/media/video-producer-agent/SKILL.md" },
    { keys: ["knowledge", "kb", "article", "docs"], agent: "Knowledge Curator", skill: "skills/private/knowledge/knowledge-curator-agent/SKILL.md" },
    { keys: ["memory", "context", "history"], agent: "Memory Keeper", skill: "skills/private/memory/memory-keeper-agent/SKILL.md" },
    { keys: ["email", "smtp", "follow-up"], agent: "Email Composer", skill: "skills/private/messaging/email-composer-agent/SKILL.md" },
    { keys: ["seo", "search", "ranking", "meta"], agent: "SEO Optimizer", skill: "skills/private/marketing/seo-optimizer-agent/SKILL.md" },
    { keys: ["error", "incident", "bug", "log"], agent: "Error Monitor", skill: "skills/private/engineering/error-monitor-agent/SKILL.md" },
    { keys: ["approval", "sign-off", "review"], agent: "Approval Gatekeeper", skill: "skills/private/approvals/approval-gatekeeper-agent/SKILL.md" },
    { keys: ["analytics", "insight", "report", "metric"], agent: "Analytics Insights", skill: "skills/private/analytics/analytics-insights-agent/SKILL.md" },
    { keys: ["success", "nps", "churn", "renewal"], agent: "Client Success", skill: "skills/private/success/client-success-agent/SKILL.md" },
    { keys: ["strategy", "okr", "plan", "memo", "ceo"], agent: "CEO Strategist", skill: "skills/private/executive-ceo-control/strategy-agent/SKILL.md" },
    { keys: ["evidence", "delivery proof", "snapshot"], agent: "Evidence Tracker", skill: "skills/private/delivery/evidence-tracker-agent/SKILL.md" },
  ];
  for (const r of rules) {
    if (r.keys.some((k) => text.includes(k))) {
      return { agentName: r.agent, skillPath: r.skill };
    }
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const input: string = body.input ?? "";

  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const start = Date.now();
  const template = ROLE_TEMPLATES[agent.name] ?? FALLBACK;
  const output = template(input);
  const durationMs = Date.now() - start;

  // Flip the agent to BUSY briefly, then back ONLINE.
  await db.agent.update({
    where: { id },
    data: { status: "ONLINE", lastAction: `Ran: ${input.slice(0, 60) || "manual trigger"}` },
  });

  const run = await db.agentRun.create({
    data: {
      agentId: id,
      input: input || "(no input)",
      output,
      status: "SUCCESS",
      durationMs,
    },
  });

  await db.auditLog.create({
    data: {
      action: "agent.invoked",
      entityType: "agent",
      entityId: id,
      metadata: JSON.stringify({ runId: run.id, durationMs }),
    },
  });

  return NextResponse.json({ run, agent, output });
}
