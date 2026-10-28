import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns the AgentOS skill catalog — 10 sample categories from the manifest.
const CATALOG = [
  { category: "executive-ceo-control", path: "skills/private/executive-ceo-control", count: 24, sample: "strategy-agent/SKILL.md", description: "CEO-grade strategic planning, OKRs, board memos." },
  { category: "crm-and-automation", path: "skills/private/crm-and-automation", count: 87, sample: "manager-agent/SKILL.md", description: "Lead lifecycle, scoring, pipeline ops, follow-up automation." },
  { category: "messaging", path: "skills/private/messaging", count: 142, sample: "whatsapp-agent/SKILL.md", description: "WhatsApp, email, SMS — routing, drafting, escalation." },
  { category: "delivery", path: "skills/private/delivery", count: 64, sample: "scope-builder-agent/SKILL.md", description: "Scope building, milestone tracking, evidence capture." },
  { category: "finance", path: "skills/private/finance", count: 38, sample: "payment-verifier-agent/SKILL.md", description: "Invoicing, reconciliation, fraud signals." },
  { category: "legal", path: "skills/private/legal", count: 29, sample: "legal-reviewer-agent/SKILL.md", description: "Contract review, compliance, risk scoring." },
  { category: "marketing", path: "skills/private/marketing", count: 156, sample: "seo-optimizer-agent/SKILL.md", description: "SEO, content strategy, ad copy, A/B testing." },
  { category: "social", path: "skills/private/social", count: 73, sample: "social-media-manager-agent/SKILL.md", description: "Multi-channel scheduling, engagement, listening." },
  { category: "design", path: "skills/private/design", count: 41, sample: "brand-designer-agent/SKILL.md", description: "Brand systems, decks, design tokens." },
  { category: "analytics", path: "skills/private/analytics", count: 52, sample: "analytics-insights-agent/SKILL.md", description: "Dashboards, anomaly detection, weekly digests." },
];

export async function GET() {
  return NextResponse.json({
    totalSkills: 2000,
    totalCategories: 100,
    catalog: CATALOG,
  });
}
