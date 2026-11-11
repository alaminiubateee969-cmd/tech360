"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ShieldCheck,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from "lucide-react";
import { CASE_STUDIES, FAQS, INDUSTRIES } from "@/data/site";
import { industryImage, industryImageAlt } from "@/data/industry-images";
import {
  getCaseStudyImage,
  serviceImageAlt,
  serviceImageSrc,
} from "@/data/service-images";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";
import { SectionHeading } from "./SectionHeading";
import { ImageView } from "./ImageView";
import { Reveal, RevealItem, RevealList } from "./Reveal";
import { CtaBand } from "./CtaBand";
import { LinkArrow, OutlineLink, PrimaryLink } from "./buttons";
import {
  AiSolutionsSection,
  DashboardShowcase,
  IntegrationsGrid,
  PlatformGrid,
  SolutionsGrid,
  TrustRow,
} from "./PremiumSections";

export default function HomeView(_props: { onNavigate?: (h: string) => void } = {}) {
  return (
    <div>
      {/* 1. Premium Hero + Connected Operations Strip */}
      <Hero />
      <TrustRow />

      {/* 2. Flagship Services Overview with High-Resolution Service Imagery */}
      <FlagshipServices />

      {/* 3. Dedicated AI Solutions 3-Card Image Grid */}
      <AiSolutionsSection />

      {/* 4. Business Automation, Software Capabilities & Connected Platform */}
      <SolutionsGrid />
      <PlatformGrid />
      <DashboardShowcase />
      <IntegrationsGrid />

      {/* 5. Industry-Specific Solutions */}
      <IndustriesPreview />

      {/* 6. Trust, Engineering Standards & Illustrative Delivery Blueprints */}
      <WhyTech360 />
      <SelectedWork />

      {/* 7. Project Workflow & Human Approval Model */}
      <DeliveryJourney />

      {/* 8. Client Engagement, Engineering Insights, FAQs & Consultation CTA */}
      <ClientReviews />
      <LatestInsights />
      <FaqPreview />
      <CtaBand />
    </div>
  );
}

/* ---------------- Hero ---------------- */

const HERO_TRUST = [
  "US-registered technology company (Tech360 LLC)",
  "Written scope & client-approved deliverables",
  "HTML preview before production build",
  "Full source-code handover after completion",
];

function Hero() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [soundFailed, setSoundFailed] = useState(false);

  // Respect OS-level reduced-motion preference: pause the ambient clip rather
  // than loop motion behind text for visitors who asked for stillness.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (mq.matches) v.pause();
      else v.play().catch(() => {});
    };
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  async function toggleSound() {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !muted;
    setSoundFailed(false);
    v.muted = nextMuted;
    if (!nextMuted) {
      v.volume = 0.85;
      try {
        await v.play();
        if (v.muted || v.paused) throw new Error("audio blocked");
        setMuted(false);
      } catch {
        v.muted = true;
        setMuted(true);
        setSoundFailed(true);
      }
    } else {
      setMuted(true);
    }
  }

  return (
    <section className="relative isolate flex min-h-[min(86svh,760px)] items-center overflow-hidden bg-[#061528] text-white">
      {/* Ambient background video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/videos/hero-poster.jpg"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center motion-reduce:hidden"
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>

      {/* Readability scrim: darker on the left behind copy, lighter over the visual */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#051225]/92 via-[#07203F]/78 to-[#063B8F]/52"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#051225]/85 via-transparent to-[#051225]/45"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/95 backdrop-blur-sm">
            <Sparkles className="size-3.5 text-[#7FD4FF]" aria-hidden="true" />
            <span>Custom Software · AI Automation · Cloud Engineering</span>
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Engineering Technology.{" "}
            <span className="bg-gradient-to-r from-[#7FD4FF] via-[#4CC3FF] to-[#5AE07A] bg-clip-text text-transparent">
              Empowering Business.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            Tech360 designs and delivers bespoke web platforms, client portals, CRM systems, and human-approved AI workflows — scoped in writing, previewed before production, and handed over with full source ownership.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PrimaryLink href="/contact" className="shadow-lg shadow-[#009FE3]/25">
              Start Your Project
              <ArrowRight className="size-4" aria-hidden="true" />
            </PrimaryLink>
            <a
              href="/services"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7FD4FF]"
            >
              Explore Solutions
            </a>
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={!muted}
              aria-label={muted ? "Enable background video sound" : "Mute background video sound"}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 bg-black/25 px-3.5 py-2.5 text-xs font-semibold text-white/90 backdrop-blur-sm transition-colors hover:border-white/45 hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7FD4FF] motion-reduce:hidden"
            >
              {muted ? (
                <>
                  <VolumeX className="size-4 text-white/80" aria-hidden="true" />
                  <span>Sound off</span>
                </>
              ) : (
                <>
                  <Volume2 className="size-4 text-[#5AE07A]" aria-hidden="true" />
                  <span>Sound on</span>
                </>
              )}
            </button>
          </div>
          {soundFailed ? (
            <p role="status" className="mt-2 text-xs text-amber-200/90">
              Your browser blocked audio playback on this device. Check system mute or tab audio permissions and try again.
            </p>
          ) : null}

          <ul className="mt-10 grid gap-2.5 border-t border-white/15 pt-6 sm:grid-cols-2">
            {HERO_TRUST.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-xs text-white/85 sm:text-sm"
              >
                <CheckCircle2 className="size-4 shrink-0 text-[#5AE07A]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Flagship Services Overview (4 visual capability spotlights) ---------------- */

interface FlagshipService {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  icon: string;
  href: string;
  deliverables: string[];
  tags: string[];
}

const FLAGSHIP_SERVICES: FlagshipService[] = [
  {
    slug: "custom-software-development",
    eyebrow: "Bespoke Systems",
    title: "Custom Software & Internal Platforms",
    summary:
      "Line-of-business web applications, operations consoles, and multi-role client portals engineered around your exact data model and approval rules.",
    icon: "Code2",
    href: "/services/custom-software-development",
    deliverables: [
      "Written Scope of Work & interactive HTML preview before build",
      "Role-based access control, audit logs, and relational PostgreSQL schema",
      "Clean repository, migrations, and deployment runbook handed over",
    ],
    tags: ["Client Portals", "Operations Systems", "Source Handover"],
  },
  {
    slug: "ecommerce-platforms",
    eyebrow: "Web & Digital Commerce",
    title: "High-Performance Websites & eCommerce",
    summary:
      "Fast, mobile-first corporate websites and conversion-ready storefronts with clean information architecture, structured metadata, and payment/fulfillment hooks.",
    icon: "ShoppingBag",
    href: "/services/ecommerce-platforms",
    deliverables: [
      "Custom responsive UI — never bloated off-the-shelf templates",
      "Local & international checkout, order states, and inventory sync",
      "Technical SEO, Core Web Vitals optimization, and analytics events",
    ],
    tags: ["Corporate Web", "eCommerce", "Core Web Vitals"],
  },
  {
    slug: "custom-crm-development",
    eyebrow: "Revenue & Client Operations",
    title: "Custom CRM & Omnichannel Messaging",
    summary:
      "Replace scattered spreadsheets and disconnected chat threads with one Client ID that links enquiries, quotations, invoices, and conversational follow-ups.",
    icon: "Users",
    href: "/services/custom-crm-development",
    deliverables: [
      "Unified lead-to-invoice pipeline tailored to your sales stages",
      "Official Cloud API, transactional email, and SMS triggers",
      "Executive dashboards for conversion, response SLA, and receivables",
    ],
    tags: ["Custom CRM", "Messaging API", "Live Dashboards"],
  },
  {
    slug: "ai-business-automation",
    eyebrow: "Human-Supervised AI",
    title: "AI Assistants & Workflow Automation",
    summary:
      "Practical AI agents and n8n orchestrations that triage enquiries, draft replies, classify documents, and sync systems — with human approval before external actions.",
    icon: "Bot",
    href: "/services/ai-business-automation",
    deliverables: [
      "Scoped AI assistants grounded in your approved knowledge base",
      "Approve-first guardrails for customer replies, quotes, and publishing",
      "Retry-safe webhook and API automations with full execution logs",
    ],
    tags: ["AI Agents", "n8n Workflows", "Approval Gates"],
  },
];

function FlagshipServices() {
  return (
    <section className="border-b border-[#E2E8F0] bg-[#F7FAFC]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="Services Overview"
            title="Systems Built Around How Your Business Actually Operates"
            description="Four core engineering practices — each scoped in writing, demonstrated as an HTML preview before production code, and delivered as maintainable software."
            align="left"
            className="max-w-2xl"
          />
          <LinkArrow href="/services" className="shrink-0 text-sm">
            Explore all 21 services
          </LinkArrow>
        </div>

        <RevealList className="mt-12 grid gap-6 md:grid-cols-2">
          {FLAGSHIP_SERVICES.map((item, idx) => (
            <RevealItem key={item.slug} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_10px_rgba(11,31,51,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 hover:shadow-[0_18px_40px_rgba(6,59,143,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <a
                  href={item.href}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="relative block overflow-hidden border-b border-[#E2E8F0] bg-[#061528]"
                >
                  <ImageView
                    src={serviceImageSrc(item.slug)}
                    alt={serviceImageAlt(item.slug, item.title)}
                    aspect="16/10"
                    width={1600}
                    height={1000}
                    eager={idx < 2}
                    sizes="(max-width: 767px) 100vw, 50vw"
                    imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#040E1C]/65 to-transparent" />
                  <span className="absolute left-4 top-4 inline-flex items-center rounded-full border border-white/20 bg-[#061528]/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#9BEBFF] backdrop-blur-sm">
                    {item.eyebrow}
                  </span>
                </a>

                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#009FE3]/10 text-[#0079AC]">
                        <Icon name={item.icon} className="size-5" />
                      </span>
                      <h3 className="text-xl font-bold tracking-tight text-[#0B1F33]">
                        <a
                          href={item.href}
                          className="outline-none hover:text-[#063B8F] focus-visible:underline"
                        >
                          {item.title}
                        </a>
                      </h3>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-[#475569]">
                    {item.summary}
                  </p>

                  <ul className="mt-4 space-y-2 border-t border-[#F1F5F9] pt-4">
                    {item.deliverables.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-xs leading-relaxed text-[#334155] sm:text-sm">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-[#475569]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <LinkArrow href={item.href} className="text-xs sm:text-sm">
                      Service detail
                    </LinkArrow>
                  </div>
                </div>
              </article>
            </RevealItem>
          ))}
        </RevealList>
      </div>
    </section>
  );
}

/* ---------------- Industries preview ---------------- */

function IndustriesPreview() {
  const featured = INDUSTRIES.slice(0, 8);
  return (
    <section className="border-t border-[#E2E8F0] bg-[#F7FAFC]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="Industries We Serve"
            title="Built Around Real Industry Workflows"
            description="Twenty industry playbooks covering retail, healthcare, education, real estate, hospitality, logistics, SaaS, and professional services — adapted to how your sector actually operates."
            align="left"
          />
          <OutlineLink href="/industries" className="shrink-0">
            View all {INDUSTRIES.length} industries
          </OutlineLink>
        </div>

        <RevealList className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((industry) => (
            <RevealItem key={industry.slug} className="h-full">
              <a
                href={`/industries/${industry.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#009FE3]/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <div className="relative">
                  <ImageView
                    src={industryImage(industry.slug)}
                    alt={industryImageAlt(industry.title)}
                    aspect="16/10"
                    width={1600}
                    height={900}
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                    imgClassName="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-bold text-[#0B1F33] group-hover:text-[#063B8F]">
                    {industry.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-relaxed text-[#475569]">
                    {industry.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0079AC]">
                    Industry overview
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </div>
              </a>
            </RevealItem>
          ))}
        </RevealList>
      </div>
    </section>
  );
}

/* ---------------- Why Tech360 (credibility without fake stats) ---------------- */

const STANDARDS = [
  {
    title: "US-Registered Entity & Written Contracts",
    body: "Every engagement is contracted cleanly with Tech360 LLC under a written Scope of Work, itemized deliverables, and documented acceptance criteria.",
    icon: "Building2",
  },
  {
    title: "HTML Preview Before Production Build",
    body: "You inspect and sign off on a navigable HTML preview of screens and user journeys before backend engineering begins — preventing late surprises.",
    icon: "Eye",
  },
  {
    title: "Approve-First AI & Operational Safety",
    body: "AI assistants, outbound messaging, and financial status updates stay inside role-based permissions, human approval checkpoints, and audit trails.",
    icon: "ShieldCheck",
  },
  {
    title: "Client-Owned Code & Clean Handover",
    body: "Upon final milestone completion, your repository, database schema, deployment configuration, and operational documentation belong to your organization.",
    icon: "KeyRound",
  },
];

function WhyTech360() {
  return (
    <section className="bg-[#0B1F33] text-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-5">
            <span className="inline-block rounded-full border border-[#009FE3]/40 bg-[#009FE3]/15 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#7FD4FF]">
              Why Tech360
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Accountable Engineering, Clear Governance, Zero Guesswork
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75">
              Software projects fail when scope is vague, progress is invisible, or vendors lock away your code. Tech360 structures every engagement around transparent checkpoints so both technical and non-technical stakeholders stay in control.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <PrimaryLink href="/about">
                About Tech360
                <ArrowRight className="size-4" aria-hidden="true" />
              </PrimaryLink>
              <a
                href="/portal"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/10"
              >
                Client Portal Sign In
              </a>
            </div>
          </Reveal>

          <RevealList className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            {STANDARDS.map((s) => (
              <RevealItem key={s.title} className="h-full">
                <div className="flex h-full flex-col rounded-2xl border border-white/12 bg-white/[0.05] p-6 backdrop-blur-sm">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#009FE3]/20 text-[#7FD4FF]">
                    <Icon name={s.icon} className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/75">{s.body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Selected Work / Solution Blueprints ---------------- */

function SelectedWork() {
  const featured = CASE_STUDIES.slice(0, 3);
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <SectionHeading
          eyebrow="Selected Work & Blueprints"
          title="Representative Delivery Scenarios"
          description="Illustrative architecture scenarios showing how Tech360 structures real operational problems, solutions, and outcomes — clearly labelled rather than presented as named client endorsements."
          align="left"
        />
        <OutlineLink href="/work" className="shrink-0">
          Explore work &amp; blueprints
        </OutlineLink>
      </div>

      <RevealList className="mt-12 grid gap-6 lg:grid-cols-3">
        {featured.map((study) => {
          const visual = getCaseStudyImage(study.slug);
          return (
            <RevealItem key={study.slug} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <a
                  href="/work/case-studies"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="relative block overflow-hidden border-b border-[#E2E8F0] bg-[#061528]"
                >
                  <ImageView
                    src={visual?.src}
                    alt={visual?.alt ?? `${study.title} — illustrative delivery blueprint`}
                    aspect="16/10"
                    width={1600}
                    height={1000}
                    sizes="(max-width: 1023px) 100vw, 33vw"
                    imgClassName="transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#040E1C]/60 to-transparent" />
                  <span className="absolute left-3.5 top-3.5 rounded-full border border-white/20 bg-[#061528]/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#9BEBFF] backdrop-blur-sm">
                    {study.industry}
                  </span>
                </a>

                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#0079AC]">
                      Delivery Blueprint
                    </span>
                    <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-medium text-[#64748B]">
                      Illustrative scenario
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-lg font-bold leading-snug text-[#0B1F33]">
                    {study.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#475569]">
                    <strong className="font-semibold text-[#0B1F33]">Challenge:</strong>{" "}
                    {study.challenge}
                  </p>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[#475569]">
                    <strong className="font-semibold text-[#0B1F33]">Approach:</strong>{" "}
                    {study.approach}
                  </p>
                  <div className="mt-5 border-t border-[#F1F5F9] pt-4">
                    <p className="text-xs font-semibold text-[#15803D]">
                      Target outcome: {study.outcome}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {study.stack.slice(0, 3).map((tech) => (
                        <span
                          key={tech}
                          className="rounded-md bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-medium text-[#475569]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            </RevealItem>
          );
        })}
      </RevealList>
    </section>
  );
}

/* ---------------- Customer Delivery Journey ---------------- */

const JOURNEY_STEPS = [
  { n: "01", title: "Enquiry & Unique Client ID", detail: "Your brief is logged under one permanent Client ID so context is never lost." },
  { n: "02", title: "Discovery & Written Scope", detail: "Requirements, integrations, milestones, and quotation documented in writing." },
  { n: "03", title: "Interactive HTML Preview", detail: "Review and approve real screens and flows before production build starts." },
  { n: "04", title: "Milestone Engineering & QA", detail: "Backend, database, security, and integrations built with staging checkpoints." },
  { n: "05", title: "Deployment & Source Handover", detail: "Production launch, team walkthrough, and full source-code delivery." },
];

function DeliveryJourney() {
  return (
    <section className="border-y border-[#E2E8F0] bg-[#F7FAFC]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="How Delivery Works"
            title="A Predictable Path From Brief to Production"
            description="Every engagement follows explicit review gates — written Scope of Work, client-approved HTML preview, staged engineering, and documented handover."
            align="left"
          />
          <LinkArrow href="/process" className="shrink-0 text-sm">
            View the full 7-step process
          </LinkArrow>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {JOURNEY_STEPS.map((step) => (
            <li
              key={step.n}
              className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
            >
              <span className="font-mono text-xs font-bold tracking-widest text-[#0079AC]">
                STEP {step.n}
              </span>
              <h3 className="mt-2 text-base font-bold text-[#0B1F33]">{step.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#475569]">{step.detail}</p>
            </li>
          ))}
        </ol>

        <p className="mt-6 flex items-center gap-2 text-xs text-[#526173]">
          <ShieldCheck className="size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
          <span>
            Approval gate policy: Scope of Work is approved before build; agreed source code is released once final milestone settlement clears.
          </span>
        </p>
      </div>
    </section>
  );
}

/* ---------------- Approved Client Reviews (renders ONLY when real reviews exist) ---------------- */

interface ApprovedReview {
  id: string;
  rating: number;
  headline: string | null;
  comment: string;
  authorName: string;
  companyName: string | null;
  projectTitle: string | null;
}

function ClientReviews() {
  const [reviews, setReviews] = useState<ApprovedReview[]>([]);

  useEffect(() => {
    fetch("/api/public/reviews", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((d: { reviews?: ApprovedReview[] }) => {
        if (Array.isArray(d.reviews)) setReviews(d.reviews.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Verified Client Feedback"
        title="Reviews From Completed Engagements"
        description="Submitted by authenticated clients inside the Tech360 portal after project delivery."
      />
      <RevealList className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((rev) => (
          <RevealItem key={rev.id} className="h-full">
            <figure className="flex h-full flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <div>
                <div
                  className="flex items-center gap-0.5 text-amber-500"
                  aria-label={`${rev.rating} out of 5 stars`}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-4",
                        i < rev.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-200"
                      )}
                    />
                  ))}
                </div>
                {rev.headline ? (
                  <p className="mt-3 text-base font-bold text-[#0B1F33]">
                    {rev.headline}
                  </p>
                ) : null}
                <blockquote className="mt-2 text-sm leading-relaxed text-[#475569]">
                  &ldquo;{rev.comment}&rdquo;
                </blockquote>
              </div>
              <figcaption className="mt-5 border-t border-[#F1F5F9] pt-3 text-xs">
                <div className="font-semibold text-[#0B1F33]">{rev.authorName}</div>
                <div className="text-[#64748B]">
                  {[rev.companyName, rev.projectTitle].filter(Boolean).join(" · ") ||
                    "Verified Tech360 Client"}
                </div>
              </figcaption>
            </figure>
          </RevealItem>
        ))}
      </RevealList>
    </section>
  );
}

/* ---------------- Latest Insights (live from /api/blog when published posts exist) ---------------- */

interface HomePost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverImage: string | null;
  readMinutes: number;
  publishedAt: string | null;
}

function fmtPostDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function LatestInsights() {
  const [posts, setPosts] = useState<HomePost[] | null>(null);

  useEffect(() => {
    fetch("/api/blog")
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d: { posts?: HomePost[] }) => {
        setPosts(Array.isArray(d.posts) ? d.posts.slice(0, 3) : []);
      })
      .catch(() => setPosts([]));
  }, []);

  if (!posts || posts.length === 0) return null;

  return (
    <section className="border-b border-[#E2E8F0] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Engineering Notes & Guides"
            title="Latest Insights From Tech360"
            description="Practical articles on software architecture, CRM operations, and human-supervised AI automation."
            align="left"
          />
          <OutlineLink href="/blog" className="shrink-0">
            Read all articles
          </OutlineLink>
        </div>

        <RevealList className="mt-12 grid gap-6 md:grid-cols-3">
          {posts.map((post) => (
            <RevealItem key={post.slug} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#009FE3]/50 hover:shadow-md">
                {post.coverImage ? (
                  <a href={`/blog/${post.slug}`} className="block">
                    <ImageView
                      src={post.coverImage}
                      alt={post.title}
                      aspect="16/10"
                      imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </a>
                ) : null}
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                    <span className="rounded-full bg-[#009FE3]/10 px-2.5 py-0.5 font-semibold text-[#0079AC]">
                      {post.category}
                    </span>
                    {post.publishedAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3.5" aria-hidden="true" />
                        {fmtPostDate(post.publishedAt)}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {post.readMinutes} min
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold leading-snug text-[#0B1F33] group-hover:text-[#063B8F]">
                    <a href={`/blog/${post.slug}`}>{post.title}</a>
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-[#475569]">
                    {post.excerpt}
                  </p>
                  <div className="mt-4 pt-2">
                    <LinkArrow href={`/blog/${post.slug}`} className="text-xs">
                      Read article
                    </LinkArrow>
                  </div>
                </div>
              </article>
            </RevealItem>
          ))}
        </RevealList>
      </div>
    </section>
  );
}

/* ---------------- Compact FAQ Preview ---------------- */

function FaqPreview() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const topFaqs = FAQS.slice(0, 5);

  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeading
          eyebrow="Common Questions"
          title="Straight Answers Before You Reach Out"
          description="Scope, pricing structure, previews, code ownership, and post-launch care."
          align="left"
        />
        <LinkArrow href="/faq" className="shrink-0 text-sm">
          All {FAQS.length} FAQs
        </LinkArrow>
      </div>

      <div className="mt-10 divide-y divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white">
        {topFaqs.map((faq, idx) => {
          const open = openIndex === idx;
          return (
            <div key={faq.q} className="p-5 sm:p-6">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : idx)}
                className="flex w-full items-center justify-between gap-4 text-left text-base font-semibold text-[#0B1F33] outline-none focus-visible:text-[#063B8F]"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-[#0079AC] transition-transform duration-200",
                    open && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>
              {open ? (
                <p className="mt-3 pr-6 text-sm leading-relaxed text-[#475569]">
                  {faq.a}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
