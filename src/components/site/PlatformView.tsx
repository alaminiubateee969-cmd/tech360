"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { AI_NATIVE_MESSENGER, PLATFORM_PILLARS, PRODUCED_SYSTEMS } from "@/data/site";
import { getProducedSystemImage } from "@/data/service-images";
import { PageHero } from "./PageHero";
import { SectionHeading } from "./SectionHeading";
import { Icon } from "./icons";
import { ImageView } from "./ImageView";
import { RevealItem, RevealList } from "./Reveal";
import { CtaBand } from "./CtaBand";
import { LinkArrow, OutlineLink, PrimaryLink } from "./buttons";
import {
  DashboardShowcase,
  FeaturesGrid,
  IntegrationsGrid,
  PlatformGrid,
} from "./PremiumSections";

const ECOSYSTEM_MODULES = [
  {
    id: "crm",
    name: "TECH360 CRM",
    status: "LIVE PLATFORM MODULE",
    tagline: "Lead capture, permanent Client IDs, 20-stage sales pipeline, and omnichannel communication.",
    capabilities: [
      "Monotonic TECH-YYYY-NNNNNN Client ID allocation on first contact",
      "Table & Kanban pipeline views with bulk CSV import and RFC-4180 export",
      "Unified email, WhatsApp, SMS, and portal communication history",
      "Scoped proposals, quotations, and milestone conversion tracking",
    ],
    href: "/services/custom-crm-development",
  },
  {
    id: "agentos",
    name: "TECH360 AgentOS",
    status: "LIVE PLATFORM MODULE",
    tagline: "Governed AI agent orchestration across 44 canonical agents and 110 departments.",
    capabilities: [
      "Server-side adapters for OpenAI, Google Gemini, Groq, OpenRouter, AI Gateway, and Z.AI",
      "Per-agent model selection, daily token quotas, and execution ledger persistence",
      "RBAC tool allowlists, tenant isolation, and human Super Admin approval gates",
      "Deterministic fallback so CRM and Client Portal operate even without an AI key",
    ],
    href: "/services/ai-agent-systems",
  },
  {
    id: "flow",
    name: "TECH360 Flow",
    status: "LIVE PLATFORM MODULE",
    tagline: "Event-driven workflow automation with triggers, conditions, retries, and approval checkpoints.",
    capabilities: [
      "Durable background job queue with bounded exponential backoff",
      "Gated customer milestone notifications and webhook signature verification",
      "Step-by-step execution logs, failure diagnostics, and manual operator approval",
      "Self-hosted n8n and custom webhook integration bridges",
    ],
    href: "/services/ai-business-automation",
  },
  {
    id: "client-hub",
    name: "TECH360 Client Hub",
    status: "LIVE PLATFORM MODULE",
    tagline: "Authenticated client workspace for Scope of Work approvals, previews, invoices, and handover.",
    capabilities: [
      "Strict tenant-isolated login via Client ID + verified email or phone",
      "Online Scope of Work approval, revision notes, and interactive HTML preview review",
      "Evidence-only payment proof submission and verified invoice/receipt downloads",
      "Token-gated source-code repository handover after verified settlement",
    ],
    href: "/portal",
  },
  {
    id: "intelligence",
    name: "TECH360 Intelligence",
    status: "LIVE PLATFORM MODULE",
    tagline: "Executive KPI dashboards, funnel telemetry, audit logs, and compliance reporting.",
    capabilities: [
      "Real-time pipeline conversion, revenue ledger, and SLA tracking",
      "Agent token consumption, success rates, and latency diagnostics",
      "Immutable, PII-redacted security and operational audit trail",
      "Consent-aware analytics and exportable operational reports",
    ],
    href: "/services/business-dashboards",
  },
  {
    id: "commerce",
    name: "TECH360 Commerce",
    status: "SCOPED CUSTOM DELIVERY",
    tagline: "Custom eCommerce storefronts, catalog engines, order workflows, and payment integrations.",
    capabilities: [
      "Bespoke product catalogs, variants, inventory, and checkout flows",
      "Multi-currency invoicing and regional payment gateway webhooks",
      "Customer order tracking portals connected to your CRM record",
      "Delivered under a written Scope of Work with full source ownership",
    ],
    href: "/services/ecommerce-platforms",
  },
  {
    id: "studio",
    name: "TECH360 Studio",
    status: "SCOPED CUSTOM DELIVERY",
    tagline: "Corporate web engineering, interactive 3D product showcases, and digital brand systems.",
    capabilities: [
      "High-performance Next.js, React, and TypeScript web applications",
      "Interactive 3D visualizations, motion graphics, and responsive design systems",
      "Technical SEO, structured data, accessibility, and Core Web Vitals optimization",
      "Interactive HTML preview approval prior to production engineering",
    ],
    href: "/services/custom-software-development",
  },
];

export default function PlatformView() {
  const [selectedProduct, setSelectedProduct] = useState(ECOSYSTEM_MODULES[0].id);
  const activeProduct =
    ECOSYSTEM_MODULES.find((m) => m.id === selectedProduct) ?? ECOSYSTEM_MODULES[0];

  return (
    <div>
      <PageHero
        eyebrow="Company-in-a-Box · Build. Automate. Transform. Grow."
        title="Your Business. One Connected Platform. Complete Control."
        description="Connect the people, information, and workflows that help your business move forward. We work with you to define a solution around your goals and an agreed scope."
        breadcrumb={[{ label: "Platform" }]}
      >
        <div className="flex flex-wrap gap-3">
          <PrimaryLink href="/contact">
            Book a Platform Walkthrough
            <ArrowRight className="size-4" aria-hidden="true" />
          </PrimaryLink>
          <a
            href="/portal"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/15"
          >
            Client Portal Sign In
          </a>
        </div>
      </PageHero>

      {/* Connected TECH360 Product Ecosystem */}
      <section className="border-b border-[#E2E8F0] bg-[#07152B] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            dark
            eyebrow="Connected Product Ecosystem"
            title="Unified Product Family Built on Shared Identity, RBAC & Auditability"
            description="Every module shares authentication, tenant boundaries, relational data, and audit trails. Live platform capabilities and custom-scoped deliveries are clearly distinguished below."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-2 lg:col-span-5">
              {ECOSYSTEM_MODULES.map((mod) => {
                const isSelected = mod.id === activeProduct.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setSelectedProduct(mod.id)}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      isSelected
                        ? "border-[#009FE3] bg-[#0066CC]/25 shadow-lg"
                        : "border-white/12 bg-white/5 hover:border-white/25 hover:bg-white/10"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{mod.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-white/70">
                        {mod.tagline}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                        mod.status === "LIVE PLATFORM MODULE"
                          ? "bg-[#18B83A]/20 text-[#5AE07A]"
                          : "bg-[#E8501A]/25 text-[#FFB347]"
                      }`}
                    >
                      {mod.status}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#0B1F33] to-[#051225] p-6 shadow-xl lg:col-span-7 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-4">
                <div>
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#7FD4FF]">
                    Product Architecture Specification
                  </span>
                  <h3 className="mt-1 text-2xl font-bold text-white">
                    {activeProduct.name}
                  </h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${
                    activeProduct.status === "LIVE PLATFORM MODULE"
                      ? "border border-[#5AE07A]/40 bg-[#18B83A]/20 text-[#5AE07A]"
                      : "border border-[#FFB347]/40 bg-[#E8501A]/25 text-[#FFB347]"
                  }`}
                >
                  {activeProduct.status}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-white/85">
                {activeProduct.tagline}
              </p>

              <ul className="mt-6 space-y-3">
                {activeProduct.capabilities.map((cap) => (
                  <li
                    key={cap}
                    className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/90 sm:text-sm"
                  >
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-[#5AE07A]"
                      aria-hidden="true"
                    />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
                <span className="text-xs text-white/65">
                  Shared foundation: Scrypt Auth · 12-Role RBAC · AuditLog · Tenant Isolation
                </span>
                <LinkArrow href={activeProduct.href}>
                  Explore {activeProduct.name}
                </LinkArrow>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Pillars */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Architectural Foundations"
          title="Five Pillars Under Every System We Ship"
          description="Every portal, CRM, eCommerce store, and internal tool Tech360 builds rests on consistent identity, relational data, role-based access, and auditability."
        />
        <RevealList className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_PILLARS.map((pillar) => (
            <RevealItem key={pillar.key} className="h-full">
              <article className="flex h-full flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#009FE3]/10 text-[#0079AC]">
                  <Icon name={pillar.icon} className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-[#0B1F33]">
                  {pillar.title}
                </h3>
                <p className="mt-1 text-xs font-semibold text-[#0079AC]">
                  {pillar.tagline}
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-[#475569]">
                  {pillar.description}
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 border-t border-[#F1F5F9] pt-3.5">
                  {pillar.provides.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs text-[#334155]"
                    >
                      <CheckCircle2
                        className="mt-0.5 size-3.5 shrink-0 text-[#18B83A]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </RevealItem>
          ))}
        </RevealList>
      </section>

      {/* Connected Platform Modules (with dedicated 1600×1000 visuals) */}
      <PlatformGrid />

      {/* Console Preview */}
      <DashboardShowcase />

      {/* Unified Client Messaging */}
      <section className="border-y border-[#E2E8F0] bg-[#0B1F33] text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            dark
            eyebrow={AI_NATIVE_MESSENGER.eyebrow}
            title={AI_NATIVE_MESSENGER.title}
            description={AI_NATIVE_MESSENGER.description}
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {AI_NATIVE_MESSENGER.capabilities.map((cap) => (
              <div
                key={cap.title}
                className="rounded-2xl border border-white/12 bg-white/5 p-6"
              >
                <h3 className="text-base font-bold text-white">{cap.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">
                  {cap.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built-in Controls */}
      <FeaturesGrid />

      {/* Produced Systems Catalogue (with sector architecture visuals) */}
      <section className="border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading
              eyebrow="Industry Operating Systems"
              title="Named System Architectures Adapted to Your Organisation"
              description="Blueprints for education, healthcare, hospitality, real estate, commerce, and field operations — tailored per engagement under a written Scope of Work and handed over as your own software."
              align="left"
            />
            <OutlineLink href="/industries" className="shrink-0">
              All 20 industries
            </OutlineLink>
          </div>

          <p className="mt-6 max-w-3xl text-sm leading-6 text-[#526173]">
            These are illustrative concepts, not verified customer projects or a
            promise of ready-to-use products. Features and delivery depend on the
            agreed scope.
          </p>

          <RevealList className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PRODUCED_SYSTEMS.map((sys) => {
              const sysImg = getProducedSystemImage(sys.slug);
              const targetHref = sysImg?.href ?? "/industries";
              return (
                <RevealItem key={sys.slug} className="h-full">
                  <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/55 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                    {sysImg ? (
                      <a
                        href={targetHref}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="relative block overflow-hidden border-b border-[#E2E8F0] bg-[#061528]"
                      >
                        <ImageView
                          src={sysImg.src}
                          alt={sysImg.alt}
                          aspect="16/10"
                          width={sysImg.width}
                          height={sysImg.height}
                          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                          imgClassName="transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                        />
                        <span className="absolute left-3.5 top-3.5 rounded-full border border-white/20 bg-[#061528]/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#9BEBFF] backdrop-blur-sm">
                          {sys.category}
                        </span>
                      </a>
                    ) : null}

                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#0079AC]">
                          {sys.category} · Illustrative concept
                        </span>
                        <span className="rounded-md bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#475569]">
                          Client-owned build
                        </span>
                      </div>
                      <h3 className="mt-2.5 text-xl font-bold text-[#0B1F33]">
                        {sys.title}
                      </h3>
                      <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#0B1F33]">
                        {sys.whatYouGet}
                      </p>
                      <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[#475569]">
                        {sys.whyIndustry}
                      </p>
                      <div className="mt-5 border-t border-[#F1F5F9] pt-4">
                        <LinkArrow href={targetHref} className="text-xs">
                          See {sys.category.toLowerCase()} playbook
                        </LinkArrow>
                      </div>
                    </div>
                  </article>
                </RevealItem>
              );
            })}
          </RevealList>

          <p className="mt-8 flex items-center gap-2 text-xs text-[#526173]">
            <ShieldCheck
              className="size-4 shrink-0 text-[#18B83A]"
              aria-hidden="true"
            />
            <span>
              Ownership policy: custom systems are scoped in writing, previewed as HTML before build, and handed over with full source code after final payment clears.
            </span>
          </p>
        </div>
      </section>

      {/* Integrations */}
      <IntegrationsGrid />

      <CtaBand
        title="Want to see how the Tech360 platform fits your operations?"
        description="Share your current tools and bottlenecks — we will map a clean, phased architecture with no obligation."
      />
    </div>
  );
}
