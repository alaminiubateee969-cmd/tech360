"use client";

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

export default function PlatformView() {
  return (
    <div>
      <PageHero
        eyebrow="The Tech360 Platform"
        title="Your Business. One Connected Platform. Complete Control."
        description="Tech360 combines custom software engineering with a connected operational backbone — role-based workspaces, client portals, human-approved AI workflows, and full source-code ownership."
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

          <RevealList className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                          {sys.category}
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
