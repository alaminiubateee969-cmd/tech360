"use client";

import {
  ArrowRight, BarChart3, BookOpen, Bot, Briefcase, CalendarClock, CheckCircle2, Code2, FileText,
  Gauge, Layers, LifeBuoy, Link2, Lock, Megaphone, MessagesSquare, Newspaper,
  PanelsTopLeft, ScrollText, Search, ShieldCheck, UserRound, Workflow,
} from "lucide-react";
import { imageFor } from "@/data/images";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";
import { LinkArrow } from "./buttons";

/* Premium homepage sections built from real Tech360 capabilities.
   No invented customers, metrics, prices, or integrations: anything
   that needs configuration is labelled as such. */

const wrap = "mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8";
const cardCls = "group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(11,31,51,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(11,31,51,0.10)] focus-within:ring-2 focus-within:ring-[#009FE3]";

function Img({ src, alt }: { src?: string; alt: string }) {
  if (!src) return <div className="aspect-[16/9] w-full bg-gradient-to-br from-[#063B8F] to-[#009FE3]" aria-hidden="true" />;
  // Hosted photography from the site image catalogue.
  return <img src={src} alt={alt} loading="lazy" className="aspect-[16/9] w-full object-cover" width={800} height={450} />;
}

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

/* ---------------- AI Solutions (§5) ---------------- */
const SOLUTIONS = [
  { icon: Workflow, img: imageFor("tech", 0), title: "AI Business Automation", desc: "Automate repetitive tasks and coordinate workflows across business operations.", caps: ["Workflow orchestration across tools", "Approval gates before anything sends", "Full activity and error logs"], href: "#/services/ai-business-automation", cta: "Explore automation" },
  { icon: Bot, img: imageFor("professional", 0), title: "AI Agents and Assistants", desc: "Use specialized AI assistants to support research, operations, analysis, and customer service.", caps: ["Specialized assistants per department", "Human approval for external actions", "Evidence-based activity records"], href: "#/services/ai-agent-systems", cta: "Meet the assistants" },
  { icon: MessagesSquare, img: imageFor("localbusiness", 0), title: "Customer Engagement", desc: "Improve customer communication through connected messaging, response assistance, and workflow automation.", caps: ["Multichannel inbox in one place", "Draft replies prepared for review", "Conversation history in the CRM"], href: "#/services/whatsapp-automation", cta: "See engagement" },
  { icon: BarChart3, img: imageFor("finance", 0), title: "Business Intelligence", desc: "Turn business information into actionable insights and more informed decisions.", caps: ["KPI dashboards and reports", "One reconciled source of truth", "Scheduled summaries for leaders"], href: "#/services/business-dashboards", cta: "View dashboards" },
  { icon: Megaphone, img: imageFor("marketing", 0), title: "Marketing Automation", desc: "Coordinate content planning, campaign workflows, and performance reporting.", caps: ["Idea-to-draft campaign generation", "Approve-first social publishing", "Content and newsletter studios"], href: "#/services/email-automation", cta: "Plan campaigns" },
  { icon: Code2, img: imageFor("tech", 1), title: "AI-Powered Development", desc: "Accelerate product development and streamline software workflows with AI-assisted tools.", caps: ["App factory with exportable source", "Architecture and deployment stages", "Review gates before release"], href: "#/services/custom-software-development", cta: "Build with AI" },
];
export function SolutionsGrid() {
  return (
    <section aria-labelledby="solutions-h" className="bg-[#F7FAFC]">
      <div className={wrap}>
        <SectionHeading id="solutions-h" eyebrow="AI Solutions" title="AI Solutions for Every Business Challenge" description="Six connected solution areas, each delivered as working software — scoped in writing, previewed before payment, and handed over with source code." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s) => (
            <Reveal key={s.title}>
              <article className={cardCls}>
                <Img src={s.img} alt={`${s.title} — illustrative business photograph`} />
                <div className="flex grow flex-col p-6">
                  <s.icon className="size-6 text-[#009FE3]" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-bold text-[#0B1F33]">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#526173]">{s.desc}</p>
                  <ul className="mt-4 space-y-1.5">
                    {s.caps.map((c) => (
                      <li key={c} className="flex gap-2 text-sm text-[#33475B]"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />{c}</li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-5"><LinkArrow href={s.href}>{s.cta}</LinkArrow></div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Products / platform (§6) ---------------- */
const PRODUCTS = [
  { icon: PanelsTopLeft, title: "Client Portal", cat: "AI workspace", text: "Projects, files, invoices, approvals and updates in one signed-in home for your clients.", href: "#/portal", action: "Open the portal" },
  { icon: UserRound, title: "CRM & Business Operations", cat: "Business operations", text: "Leads, clients, projects, tasks, invoices and payments with role-based access and audit trails.", href: "#/technologies", action: "See the platform" },
  { icon: Workflow, title: "Automation Workflows", cat: "Workflow automation", text: "n8n-powered integrations and scheduled jobs connecting the tools you already use.", href: "#/services/n8n-workflow-automation", action: "Automate a workflow" },
  { icon: Megaphone, title: "Marketing Operations", cat: "Marketing operations", text: "Content studio, media planning, newsletter and approve-first social publishing.", href: "#/services/email-automation", action: "Run marketing" },
  { icon: BarChart3, title: "Analytics & Reporting", cat: "Analytics and reporting", text: "Dashboards, SEO audits and scheduled reports built from your real business data.", href: "#/services/business-dashboards", action: "Get visibility" },
  { icon: Code2, title: "App Factory & Developer Tools", cat: "Integrations and developer tools", text: "Generate application scaffolds, preview them live, and export source or deploy packages.", href: "#/design-kit", action: "Explore the factory" },
];
export function PlatformGrid() {
  return (
    <section aria-labelledby="platform-h" className="bg-white">
      <div className={wrap}>
        <SectionHeading id="platform-h" eyebrow="Products" title="One Connected Platform. Multiple Business Capabilities." description="Modules that genuinely exist in the Tech360 platform today — preview the interface patterns live in the design kit." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <Reveal key={p.title}>
              <article className={cardCls}>
                <div className="flex grow flex-col p-6">
                  <span className="inline-flex w-fit items-center rounded-full bg-[#F4FAFF] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#063B8F]">{p.cat}</span>
                  <p.icon className="mt-4 size-6 text-[#009FE3]" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-bold text-[#0B1F33]">{p.title}</h3>
                  <p className="mt-2 grow text-sm leading-6 text-[#526173]">{p.text}</p>
                  <div className="pt-5"><LinkArrow href={p.href}>{p.action}</LinkArrow></div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
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
        <p className="mt-8 text-center"><LinkArrow href="#/process">See the full delivery process</LinkArrow></p>
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
                <a href="#/contact" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#009FE3] px-5 text-sm font-semibold text-white transition hover:bg-[#0090CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2">Book a Demo <ArrowRight className="size-4" aria-hidden="true" /></a>
                <a href="#/portal" className="inline-flex min-h-11 items-center rounded-lg border border-[#CBD5E1] px-5 text-sm font-semibold text-[#0B1F33] transition hover:border-[#009FE3] hover:text-[#009FE3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]">Client Sign In</a>
              </div>
            </div>
          </Reveal>
          <Reveal>
            <div className="grid gap-4">
              <img src="/images/admin-dashboard.png" alt="Illustrative preview of the Tech360 administrative dashboard interface" loading="lazy" width={960} height={600} className="w-full rounded-2xl border border-[#E2E8F0] shadow-[0_18px_44px_rgba(11,31,51,0.12)]" />
              <img src="/images/crm-dashboard.png" alt="Illustrative preview of the Tech360 CRM console interface" loading="lazy" width={960} height={600} className="w-full rounded-2xl border border-[#E2E8F0] shadow-[0_18px_44px_rgba(11,31,51,0.12)]" />
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
  { cat: "Developer tools", items: "App factory exports, API integrations and deploy packages", state: "Built into the platform" },
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
  { icon: FileText, title: "Fixed-Scope Project", price: "Written quotation", items: ["Defined scope approved before work begins", "HTML preview before payment", "Milestones on the record", "Source code on full payment"], cta: "Request a quotation" },
  { icon: CalendarClock, title: "Ongoing Partnership", price: "Monthly, scoped monthly", items: ["Continuous improvements and support", "Automation monitoring and tuning", "Monthly reporting and reviews", "Priority change queue"], cta: "Discuss a partnership" },
  { icon: ShieldCheck, title: "Custom / Enterprise", price: "Custom quotation", items: ["Multi-team or multi-branch rollouts", "Custom integrations and data migration", "Dedicated delivery management", "Security and access review"], cta: "Talk to us" },
];
export function PricingSection() {
  return (
    <section aria-labelledby="pricing-h" className="bg-[#F7FAFC]">
      <div className={wrap}>
        <SectionHeading id="pricing-h" eyebrow="Pricing" title="Scoped in Writing. Previewed Before Payment." description="Tech360 does not publish a rate card, because no two business systems cost the same. Every engagement starts with a written scope and quotation — you approve an HTML preview before paying. No hidden restrictions, no invented discounts." />
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
                  <a href="#/contact" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#063B8F] px-5 text-sm font-semibold text-white transition hover:bg-[#052f72] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]">{e.cta}</a>
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
  { icon: Newspaper, cat: "Articles & insights", title: "Blog", text: "Engineering notes, delivery lessons and practical guides from real builds.", href: "#/blog" },
  { icon: BookOpen, cat: "Guides & tutorials", title: "How We Work", text: "The seven-phase delivery process, approval gates and handover, explained.", href: "#/process" },
  { icon: PanelsTopLeft, cat: "Product documentation", title: "Design Kit", text: "Live diagrams, components and interface patterns used across the platform.", href: "#/design-kit" },
  { icon: LifeBuoy, cat: "FAQs", title: "Questions, Answered", text: "Scope, pricing model, timelines, ownership and support — answered plainly.", href: "#/faq" },
  { icon: Briefcase, cat: "Case studies", title: "Selected Work", text: "Representative engagements and what was actually delivered.", href: "#/work" },
  { icon: Layers, cat: "AI implementation", title: "AI Solutions", text: "Where AI genuinely helps a business — and where it should stay supervised.", href: "#/services/ai-business-automation" },
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
