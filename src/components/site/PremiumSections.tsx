"use client";

import { useState } from "react";
import {
  ArrowRight, BarChart3, BookOpen, Bot, Briefcase, CalendarClock, CheckCircle2, Code2, FileText,
  Gauge, Layers, LifeBuoy, Link2, Lock, Megaphone, Newspaper,
  PanelsTopLeft, ScrollText, Search, ShieldCheck, UserRound, Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICES } from "@/data/site";
import {
  getPlatformShowcaseImage,
  getServiceImage,
  serviceImageAlt,
  serviceImageSrc,
} from "@/data/service-images";
import { SectionHeading } from "./SectionHeading";
import { Reveal, RevealItem, RevealList } from "./Reveal";
import { ServiceCard } from "./ServiceCard";
import { LinkArrow, OutlineLink } from "./buttons";
import { SOLUTIONS_MEGA_COLUMNS } from "./nav-structure";

/* Premium homepage sections built from real Tech360 capabilities.
   No invented customers, metrics, prices, or integrations: anything
   that needs configuration is labelled as such. */

const wrap = "mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8";
const cardCls =
  "group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(11,31,51,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(11,31,51,0.10)] focus-within:ring-2 focus-within:ring-[#009FE3] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/* ---------------- Trust row (§4) ---------------- */
const TRUST = [
  { icon: Link2, title: "Connected business operations", text: "Website, CRM, messaging and reporting in one flow" },
  { icon: Workflow, title: "Workflow automation", text: "Repetitive steps run by approved, auditable automations" },
  { icon: Bot, title: "AI-assisted productivity", text: "Assistants draft, summarise and prepare — people approve" },
  { icon: BarChart3, title: "Centralized business intelligence", text: "One dashboard instead of five spreadsheet exports" },
];
export function TrustRow() {
  return (
    <section aria-label="What the platform connects" className="border-b border-[#E2E8F0] bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {TRUST.map((t) => (
          <div key={t.title} className="flex gap-3">
            <t.icon className="mt-0.5 size-6 shrink-0 text-[#009FE3]" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-[#0B1F33]">{t.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-[#526173]">{t.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- AI Solutions — Dedicated 3-Card Image Grid ---------------- */

const AI_SOLUTION_CARDS = [
  {
    slug: "ai-agent-systems",
    title: "AI Agent Systems",
    href: "/services/ai-agent-systems",
    description: "Scoped customer & operational assistants with approval guardrails.",
    badges: ["Approval guardrails", "Execution audit log"],
  },
  {
    slug: "ai-business-automation",
    title: "AI Business Automation",
    href: "/services/ai-business-automation",
    description: "Document triage, routing, classification & human-verified actions.",
    badges: ["Document triage", "Human verification"],
  },
  {
    slug: "whatsapp-ai-sales-crm",
    title: "WhatsApp-First AI Sales CRM",
    href: "/services/whatsapp-ai-sales-crm",
    description: "Shared conversational inbox, qualification & sales pipeline.",
    badges: ["Shared inbox", "Sales pipeline"],
  },
] as const;

export function AiSolutionsSection() {
  return (
    <section aria-labelledby="ai-solutions-heading" className="border-b border-[#E2E8F0] bg-white">
      <div className={wrap}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="ai-solutions-heading"
            eyebrow="Governed AI"
            title="AI Solutions"
            description="AI you control: human-approved assistants and automation that read and write your real systems."
            align="left"
            className="max-w-2xl"
          />
          <LinkArrow href="/services" className="shrink-0 text-sm">
            All AI Solutions services
          </LinkArrow>
        </div>

        <RevealList className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {AI_SOLUTION_CARDS.map((card) => {
            const service = SERVICES.find((s) => s.slug === card.slug);
            const img = getServiceImage(card.slug);
            return (
              <RevealItem key={card.slug} className="h-full">
                <ServiceCard
                  id={card.slug}
                  title={card.title}
                  description={card.description}
                  imageSrc={img?.src}
                  imageAlt={serviceImageAlt(card.slug, card.title)}
                  href={card.href}
                  category="AI Solutions"
                  icon={service?.icon}
                  badges={card.badges}
                  ctaLabel="Explore AI solution"
                />
              </RevealItem>
            );
          })}
        </RevealList>

        <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-[#526173]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
          Model selection, provider credentials, data boundaries, and human-approval checkpoints are agreed in the written Scope of Work before implementation.
        </p>
      </div>
    </section>
  );
}

/* ---------------- Core solutions: 4 pillars, 21 services (§5) ---------------- */

const PILLAR_META: Record<string, { label: string; blurb: string }> = {
  "software-products": {
    label: "Software Products",
    blurb: "Software you own: storefronts, portals, dashboards and internal tools built on your data model.",
  },
  "crm-automation": {
    label: "CRM & Business Automation",
    blurb: "One Client ID behind every message, with event-driven follow-up that never double-sends.",
  },
  "engineering-services": {
    label: "Web, Cloud & Engineering",
    blurb: "Fast websites, integrations, cloud deployment, hosting architecture and ongoing care.",
  },
  "ai-solutions": {
    label: "AI Solutions",
    blurb: "AI you control: human-approved assistants and automation that read and write your real systems.",
  },
};

export function SolutionsGrid() {
  // Default to Software Products on load since AI Solutions has its dedicated
  // showcase section directly above; tabs expose all 21 services with unique visuals.
  const orderedColumns = [
    ...SOLUTIONS_MEGA_COLUMNS.filter((c) => c.id !== "ai-solutions"),
    ...SOLUTIONS_MEGA_COLUMNS.filter((c) => c.id === "ai-solutions"),
  ];
  const [activePillar, setActivePillar] = useState<string>("software-products");

  const selectedColumn =
    orderedColumns.find((c) => c.id === activePillar) ?? orderedColumns[0];

  return (
    <section aria-labelledby="solutions-h" className="bg-[#F7FAFC]">
      <div className={wrap}>
        <SectionHeading
          id="solutions-h"
          eyebrow="Solutions Catalogue"
          title="Four pillars. Twenty-one services. One written scope."
          description="Every service below carries its own dedicated architecture and is scoped in writing before work starts. Select a discipline to explore visual capabilities across software products, CRM automation, web & cloud engineering, and governed AI."
        />

        {/* Accessible Pillar Tabs */}
        <div
          role="group"
          aria-label="Filter homepage services by pillar"
          className="mt-10 flex flex-wrap justify-center gap-2.5"
        >
          {orderedColumns.map((col) => {
            const active = col.id === selectedColumn.id;
            const label = PILLAR_META[col.id]?.label ?? col.heading;
            return (
              <button
                key={col.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActivePillar(col.id)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2",
                  active
                    ? "border-[#063B8F] bg-[#063B8F] text-white shadow-sm"
                    : "border-[#E2E8F0] bg-white text-[#0B1F33] hover:border-[#009FE3]/60 hover:text-[#063B8F]"
                )}
              >
                <span>{label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold",
                    active ? "bg-white/15 text-white" : "bg-[#F1F5F9] text-[#475569]"
                  )}
                >
                  {col.items.length}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-[#526173]" role="status">
          {PILLAR_META[selectedColumn.id]?.blurb ?? selectedColumn.description}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {selectedColumn.items.map((item) => {
            const slug = item.href.replace(/^#?\/services\//, "");
            const service = SERVICES.find((s) => s.slug === slug);
            const metaCategory = PILLAR_META[selectedColumn.id]?.label ?? selectedColumn.heading;
            return (
              <ServiceCard
                key={slug}
                id={slug}
                title={item.label}
                tagline={service?.tagline}
                description={item.description ?? service?.tagline ?? ""}
                imageSrc={serviceImageSrc(slug)}
                imageAlt={serviceImageAlt(slug, item.label)}
                href={item.href}
                category={metaCategory}
                icon={service?.icon}
                badges={service?.tech.slice(0, 2)}
                ctaLabel="Service detail"
              />
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#E2E8F0] pt-6 sm:flex-row">
          <p className="flex items-start gap-2 text-xs leading-5 text-[#526173]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
            Twenty-one service descriptions are defined in the public catalogue. Availability, timeline and cost are confirmed per engagement in the written proposal — never inferred from this page.
          </p>
          <OutlineLink href="/services" className="shrink-0">
            Browse all {SERVICES.length} services
          </OutlineLink>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Products / platform (§6) ---------------- */
const PRODUCTS = [
  { key: "client-portal", icon: "KeyRound", title: "Client Portal", cat: "Client workspace", text: "Projects, files, invoices, approvals and updates in one signed-in home for your clients.", href: "/portal", action: "Open the portal" },
  { key: "crm-operations", icon: "Users", title: "CRM & Business Operations", cat: "Business operations", text: "Leads, clients, projects, tasks, invoices and payments with role-based access and audit trails.", href: "/technologies", action: "See the platform" },
  { key: "automation-workflows", icon: "Workflow", title: "Automation Workflows", cat: "Workflow automation", text: "n8n-powered integrations and scheduled jobs connecting the tools you already use.", href: "/services/n8n-workflow-automation", action: "Automate a workflow" },
  { key: "marketing-operations", icon: "Mail", title: "Marketing Operations", cat: "Marketing operations", text: "Content studio, media planning, newsletter and approve-first social publishing.", href: "/services/email-automation", action: "Run marketing" },
  { key: "analytics-reporting", icon: "LayoutDashboard", title: "Analytics & Reporting", cat: "Analytics and reporting", text: "Dashboards, SEO audits and scheduled reports built from your real business data.", href: "/services/business-dashboards", action: "Get visibility" },
  { key: "developer-tooling", icon: "Code2", title: "Platform & Developer Tooling", cat: "Integrations & architecture", text: "Modular application scaffolds, staged environments, and source-code handover under the approved Scope of Work.", href: "/platform", action: "Explore the platform" },
] as const;

export function PlatformGrid() {
  return (
    <section aria-labelledby="platform-h" className="bg-white">
      <div className={wrap}>
        <SectionHeading
          id="platform-h"
          eyebrow="Platform Capabilities"
          title="One Connected Platform. Multiple Business Capabilities."
          description="Modules that genuinely exist in the Tech360 platform today — engineered around role-based permissions, audit trails, and client ownership."
        />
        <RevealList className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => {
            const asset = getPlatformShowcaseImage(p.key);
            return (
              <RevealItem key={p.key} className="h-full">
                <ServiceCard
                  id={p.key}
                  title={p.title}
                  description={p.text}
                  imageSrc={asset?.src}
                  imageAlt={asset?.alt ?? `${p.title} platform capability illustration`}
                  href={p.href}
                  category={p.cat}
                  icon={p.icon}
                  ctaLabel={p.action}
                />
              </RevealItem>
            );
          })}
        </RevealList>
      </div>
    </section>
  );
}

/* ---------------- How it works (§8) ---------------- */
const STEPS = [
  { n: "01", title: "Discover", text: "Identify business challenges and opportunities in a structured intake and audit." },
  { n: "02", title: "Design", text: "Select appropriate AI tools, workflows, and integrations — scoped and quoted in writing." },
  { n: "03", title: "Automate", text: "Configure and implement the selected processes with approval gates and testing." },
  { n: "04", title: "Optimize", text: "Monitor verified results and improve workflows over time, on the record." },
];
export function HowItWorks() {
  return (
    <section aria-labelledby="how-h" className="bg-[#0B1F33]">
      <div className={wrap}>
        <SectionHeading id="how-h" dark eyebrow="How it works" title="From First Idea to Running Automation" description="A connected four-step path. The full seven-phase delivery process, with its two approval gates, is documented on the process page." />
        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n}>
              <li className="relative h-full rounded-2xl border border-white/12 bg-white/5 p-6">
                <span className="text-sm font-bold tracking-[0.2em] text-[#7FD4FF]">{s.n}</span>
                <h3 className="mt-3 text-lg font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">{s.text}</p>
                {i < STEPS.length - 1 && <ArrowRight className="absolute -right-3 top-8 hidden size-5 text-[#7FD4FF] lg:block" aria-hidden="true" />}
              </li>
            </Reveal>
          ))}
        </ol>
        <p className="mt-8 text-center"><LinkArrow href="/process">See the full delivery process</LinkArrow></p>
      </div>
    </section>
  );
}

/* ---------------- Features (§9) ---------------- */
const FEATURES = [
  { icon: Workflow, title: "Workflow orchestration", text: "Multi-step automations with retries, scheduling and failure alerts — so processes finish even when a step hiccups.", why: "Why it matters: fewer dropped tasks and hand-offs." },
  { icon: Bot, title: "AI-assisted task management", text: "Assistants prepare drafts, summaries and next actions inside your existing queues, ready for human approval.", why: "Why it matters: people review and decide, not copy-paste." },
  { icon: Link2, title: "Integration management", text: "Connected accounts and webhooks with visible status, so a broken link is found before your customers notice.", why: "Why it matters: no silent integration failures." },
  { icon: BarChart3, title: "Analytics and reporting", text: "Operational dashboards and scheduled reports reconciled from one source of truth.", why: "Why it matters: meetings start from agreed numbers." },
  { icon: Lock, title: "Role-based access control", text: "Super Admin, Admin, staff and client roles see only what their work requires.", why: "Why it matters: least-privilege access by default." },
  { icon: ScrollText, title: "Activity monitoring & audit trails", text: "Who did what, when — across approvals, publishing, payments and automations.", why: "Why it matters: every action is accountable and reviewable." },
];
export function FeaturesGrid() {
  return (
    <section aria-labelledby="features-h" className="bg-[#F7FAFC]">
      <div className={wrap}>
        <SectionHeading id="features-h" eyebrow="Platform features" title="Built-In Controls, Not Bolted-On Promises" description="Every feature below is implemented in the production platform and exercised daily — not a roadmap slide." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Reveal key={f.title}>
              <article className={cardCls}>
                <div className="flex grow flex-col p-6">
                  <f.icon className="size-6 text-[#009FE3]" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-bold text-[#0B1F33]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#526173]">{f.text}</p>
                  <p className="mt-3 text-sm font-medium text-[#063B8F]">{f.why}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Dashboard showcase (§10) ---------------- */
export function DashboardShowcase() {
  return (
    <section aria-labelledby="showcase-h" className="bg-white">
      <div className={wrap}>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <div>
              <SectionHeading id="showcase-h" align="left" eyebrow="Product showcase" title="The Console Your Team Actually Runs On" description="The administrative console and client portal are real, role-based applications — leads, projects, approvals, content, marketing and reporting in one place. Previews below are interface illustrations of the shipped product, with no customer data." />
              <ul className="mt-6 space-y-2.5">
                {["Lead-to-invoice pipeline with stage history", "Approval queues for content, publishing and payments", "Marketing dashboard: idea → draft → approve → publish", "Knowledge, memory and activity audit built in"].map((c) => (
                  <li key={c} className="flex gap-2 text-sm text-[#33475B]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />{c}</li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#009FE3] px-5 text-sm font-semibold text-white transition hover:bg-[#0090CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2">Book a Demo <ArrowRight className="size-4" aria-hidden="true" /></a>
                <a href="/portal" className="inline-flex min-h-11 items-center rounded-lg border border-[#CBD5E1] px-5 text-sm font-semibold text-[#0B1F33] transition hover:border-[#009FE3] hover:text-[#009FE3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]">Client Sign In</a>
              </div>
            </div>
          </Reveal>
          <Reveal>
            <div className="grid gap-4">
              <img src="/images/admin-dashboard.png" alt="Illustrative preview of the Tech360 administrative dashboard interface" loading="lazy" decoding="async" width={1344} height={768} sizes="(max-width: 1023px) 100vw, 50vw" className="w-full rounded-2xl border border-[#E2E8F0] shadow-[0_18px_44px_rgba(11,31,51,0.12)]" />
              <img src="/images/crm-dashboard.png" alt="Illustrative preview of the Tech360 CRM console interface" loading="lazy" decoding="async" width={1344} height={768} sizes="(max-width: 1023px) 100vw, 50vw" className="w-full rounded-2xl border border-[#E2E8F0] shadow-[0_18px_44px_rgba(11,31,51,0.12)]" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Integrations (§11) ---------------- */
const INTEGRATIONS = [
  { cat: "Communication", items: "Messaging channels, email and SMS automation", state: "Available — requires configuration" },
  { cat: "Marketing", items: "Facebook, Instagram, LinkedIn and X publishing via official APIs", state: "Available — requires configuration" },
  { cat: "Productivity", items: "Workflow automation through n8n and scheduled jobs", state: "Available — requires configuration" },
  { cat: "Data & analytics", items: "Business dashboards, SEO audits and scheduled reporting", state: "Built into the platform" },
  { cat: "Developer tools", items: "API integrations and business software delivery", state: "Built into the platform" },
  { cat: "AI providers", items: "Model providers connected per engagement with policy controls", state: "Available — requires configuration" },
];
export function IntegrationsGrid() {
  return (
    <section aria-labelledby="integrations-h" className="bg-[#F7FAFC]">
      <div className={wrap}>
        <SectionHeading id="integrations-h" eyebrow="Integrations" title="Connect the Tools Your Business Already Uses" description="Honest status labels: nothing here is claimed 'connected' until your accounts are linked and verified. Configuration happens inside your admin dashboard, with credentials stored securely on your host." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((g) => (
            <Reveal key={g.cat}>
              <article className={cardCls}>
                <div className="flex grow flex-col p-6">
                  <h3 className="text-lg font-bold text-[#0B1F33]">{g.cat}</h3>
                  <p className="mt-2 grow text-sm leading-6 text-[#526173]">{g.items}</p>
                  <span className={cnState(g.state)}>{g.state}</span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
function cnState(state: string) {
  const base = "mt-5 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ";
  return base + (state.startsWith("Built") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200");
}

/* ---------------- Benefits (§12) ---------------- */
const BENEFITS = [
  { icon: Gauge, title: "Less repetitive work", text: "Routine follow-ups, drafts and data entry run as approved automations." },
  { icon: Workflow, title: "More consistent workflows", text: "The same steps, in the same order, every time — with a record to prove it." },
  { icon: Search, title: "Better visibility into operations", text: "Pipelines, tasks and results are visible without chasing five tools." },
  { icon: FileText, title: "Faster access to information", text: "Business knowledge searchable from one place instead of scattered chats." },
  { icon: Link2, title: "Connected business tools", text: "Website, CRM, messaging, marketing and finance finally share one flow." },
  { icon: Layers, title: "More scalable processes", text: "Processes that grow with volume instead of adding manual headcount first." },
];
export function BenefitsGrid() {
  return (
    <section aria-labelledby="benefits-h" className="bg-white">
      <div className={wrap}>
        <SectionHeading id="benefits-h" eyebrow="Benefits" title="What Changes When the Work Connects" description="Practical outcomes of connected operations — described honestly, without invented percentages or guaranteed results." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <Reveal key={b.title}>
              <article className={cardCls}>
                <div className="p-6">
                  <b.icon className="size-6 text-[#009FE3]" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-bold text-[#0B1F33]">{b.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#526173]">{b.text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Pricing, honest model (§14) ---------------- */
const ENGAGEMENTS = [
  { icon: FileText, title: "Fixed-Scope Project", price: "Written quotation", items: ["Defined scope approved before authorized work", "HTML Preview where included in the agreed process", "Project-specific milestones", "Agreed source code after required payments clear"], cta: "Request a quotation" },
  { icon: CalendarClock, title: "Ongoing Partnership", price: "Monthly, scoped monthly", items: ["Continuous improvements and support", "Automation monitoring and tuning", "Monthly reporting and reviews", "Priority change queue"], cta: "Discuss a partnership" },
  { icon: ShieldCheck, title: "Custom / Enterprise", price: "Custom quotation", items: ["Multi-team or multi-branch rollouts", "Custom integrations and data migration", "Dedicated delivery management", "Security and access review"], cta: "Talk to us" },
];
export function PricingSection() {
  return (
    <section aria-labelledby="pricing-h" className="bg-[#F7FAFC]">
      <div className={wrap}>
        <SectionHeading id="pricing-h" eyebrow="Pricing" title="Scoped in Writing. Delivered as Agreed." description="TECH360 does not publish a rate card, because no two business systems cost the same. Each engagement starts with a written scope and quotation; any preview, payment milestones, delivery, and support are specified for that project." />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {ENGAGEMENTS.map((e) => (
            <Reveal key={e.title}>
              <article className={cardCls}>
                <div className="flex grow flex-col p-6">
                  <e.icon className="size-6 text-[#009FE3]" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-bold text-[#0B1F33]">{e.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-[#063B8F]">{e.price}</p>
                  <ul className="mt-4 grow space-y-1.5">
                    {e.items.map((i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#33475B]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />{i}</li>
                    ))}
                  </ul>
                  <a href="/contact" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#063B8F] px-5 text-sm font-semibold text-white transition hover:bg-[#052f72] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]">{e.cta}</a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Resources (§15) ---------------- */
const RESOURCES = [
  { icon: Newspaper, cat: "Articles & insights", title: "Blog", text: "Engineering notes, delivery lessons and practical guides from real builds.", href: "/blog" },
  { icon: BookOpen, cat: "Guides & tutorials", title: "How We Work", text: "The seven-phase delivery process, approval gates and handover, explained.", href: "/process" },
  { icon: PanelsTopLeft, cat: "Platform documentation", title: "Platform Overview", text: "Explore connected operations, customer portals, reporting and integrations for your business.", href: "/platform" },
  { icon: LifeBuoy, cat: "FAQs", title: "Questions, Answered", text: "Scope, pricing model, timelines, ownership and support — answered plainly.", href: "/faq" },
  { icon: Briefcase, cat: "Work", title: "Selected Work", text: "Illustrative system scenarios and delivery blueprints — clearly labelled, never presented as client endorsements.", href: "/work" },
  { icon: Layers, cat: "AI implementation", title: "AI Solutions", text: "Where AI genuinely helps a business — and where it should stay supervised.", href: "/services/ai-business-automation" },
];
export function ResourcesGrid() {
  return (
    <section aria-labelledby="resources-h" className="bg-white">
      <div className={wrap}>
        <SectionHeading id="resources-h" eyebrow="Resources" title="Learn Before You Commit" description="Real content with working links — guides, documentation and answers, not placeholder cards." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((r) => (
            <Reveal key={r.title}>
              <article className={cardCls}>
                <div className="flex grow flex-col p-6">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#009FE3]">{r.cat}</span>
                  <r.icon className="mt-3 size-6 text-[#009FE3]" aria-hidden="true" />
                  <h3 className="mt-2 text-lg font-bold text-[#0B1F33]">{r.title}</h3>
                  <p className="mt-2 grow text-sm leading-6 text-[#526173]">{r.text}</p>
                  <div className="pt-5"><LinkArrow href={r.href}>Explore</LinkArrow></div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
