"use client";

import { SERVICES } from "@/data/site";
import { WORK_EXAMPLE_NOTICE } from "@/data/work-examples";
import { getServiceImage, serviceImageAlt, serviceImageSrc } from "@/data/service-images";
import { PORTFOLIO_INDUSTRIES, portfolioStats, type PortfolioKind } from "@/data/portfolio";
import { cn } from "@/lib/utils";
import { PageHero } from "./PageHero";
import { SectionHeading } from "./SectionHeading";
import { ServiceCard } from "./ServiceCard";
import { CtaBand } from "./CtaBand";
import { PortfolioExplorer } from "./PortfolioExplorer";
import { PortfolioSpotlight } from "./PortfolioSpotlight";
import { EvidenceLegend } from "./PortfolioMedia";

export type WorkViewVariant = "all" | "projects" | "case-studies";

const HERO_COPY: Record<WorkViewVariant, { eyebrow: string; title: string; description: string }> = {
  all: {
    eyebrow: "Work & Blueprints",
    title: "Representative Systems & Delivery Blueprints",
    description:
      "Problem-first stories across industries — the operational bottleneck, the system we would build, how it works stage by stage, and how success would be measured. Every visual is labelled with how it was made; none is presented as a named customer endorsement.",
  },
  projects: {
    eyebrow: "System Scenarios",
    title: "Systems We Design, Build & Hand Over",
    description:
      "Twelve system specifications — storefronts, CRMs, portals, ERPs, dashboards and AI-assisted workflows — each with modules, user journey, roles, data model, integrations and a concept motion preview.",
  },
  "case-studies": {
    eyebrow: "Delivery Blueprints",
    title: "Problem → Architecture → Measurable Outcome",
    description:
      "Eight industry blueprints showing how fragmented manual processes become scoped, auditable software — with the measurement plan a real engagement would baseline before claiming any result.",
  },
};

const TABS: { id: WorkViewVariant; label: string; href: string }[] = [
  { id: "all", label: "Overview", href: "/work" },
  { id: "projects", label: "System scenarios", href: "/work/projects" },
  { id: "case-studies", label: "Delivery blueprints", href: "/work/case-studies" },
];

const KIND_FOR_VARIANT: Record<WorkViewVariant, PortfolioKind | "all"> = {
  all: "all",
  projects: "system",
  "case-studies": "blueprint",
};

export default function WorkView({ variant, subView }: { variant?: WorkViewVariant; subView?: string }) {
  const resolved: WorkViewVariant =
    variant ?? (subView === "projects" || subView === "case-studies" ? subView : "all");
  const hero = HERO_COPY[resolved];
  const stats = portfolioStats();

  const breadcrumb =
    resolved === "all"
      ? [{ label: "Work" }]
      : [{ label: "Work", href: "/work" }, { label: resolved === "projects" ? "System scenarios" : "Delivery blueprints" }];

  return (
    <div>
      <PageHero eyebrow={hero.eyebrow} title={hero.title} description={hero.description} breadcrumb={breadcrumb}>
        {/* Data-derived counts only — no invented performance numbers. */}
        <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Documented entries", value: stats.total },
            { label: "Delivery blueprints", value: stats.blueprints },
            { label: "Industries modelled", value: stats.industries },
            { label: "Motion previews", value: stats.videos },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{item.label}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-white">{item.value}</dd>
            </div>
          ))}
        </dl>
      </PageHero>

      {/* Sub-navigation */}
      <div className="sticky top-16 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <nav aria-label="Work sections" className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <a
                key={tab.id}
                href={tab.href}
                aria-current={resolved === tab.id ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full px-4 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3]",
                  resolved === tab.id
                    ? "bg-[#063B8F] text-white"
                    : "border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:border-[#009FE3] hover:text-[#063B8F]",
                )}
              >
                {tab.label}
              </a>
            ))}
          </nav>
          <a
            href="/contact"
            className="hidden min-h-10 items-center rounded-full bg-[#009FE3] px-4 text-xs font-semibold text-[#04121F] outline-none hover:bg-[#33B5EA] focus-visible:ring-2 focus-visible:ring-[#063B8F] sm:inline-flex"
          >
            Start a project
          </a>
        </div>
      </div>

      {resolved === "all" ? <PortfolioSpotlight /> : null}

      <section aria-labelledby="explore-heading" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#009FE3]">Explore all work</p>
            <h2 id="explore-heading" className="mt-2 text-2xl font-bold tracking-tight text-[#0B1F33] sm:text-3xl">
              Filter by industry, capability or technology
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#526173]">
              Each card opens a dedicated page with the full problem, workflow, media and next steps. Filtered views
              update the address bar, so you can share exactly what you are looking at.
            </p>
          </div>
        </div>

        <p
          role="note"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
        >
          <strong>How to read this portfolio:</strong> {WORK_EXAMPLE_NOTICE}
        </p>

        <EvidenceLegend className="mt-6" />

        <div className="mt-8">
          <PortfolioExplorer initialKind={KIND_FOR_VARIANT[resolved]} priorityCount={resolved === "all" ? 0 : 3} />
        </div>
      </section>

      {/* Browse by industry */}
      <section aria-labelledby="industries-strip-heading" className="border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 id="industries-strip-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-[#526173]">
            Browse by industry
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {PORTFOLIO_INDUSTRIES.map((industry) => (
              <li key={industry}>
                <a
                  href={`${TABS.find((t) => t.id === resolved)?.href ?? "/work"}?industry=${encodeURIComponent(industry)}`}
                  onClick={(event) => {
                    // Same page: let the explorer pick the filter up without a navigation.
                    event.preventDefault();
                    const url = new URL(window.location.href);
                    if (window.location.hash.startsWith("#/")) {
                      const route = window.location.hash.slice(1).split("?")[0];
                      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}#${route}?industry=${encodeURIComponent(industry)}`);
                    } else {
                      url.searchParams.set("industry", industry);
                      window.history.replaceState(window.history.state, "", url.toString());
                    }
                    window.dispatchEvent(new CustomEvent("t360-portfolio-filter", { detail: { industry } }));
                    document.getElementById("explore-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex min-h-10 items-center rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-xs font-semibold text-[#334155] outline-none hover:border-[#009FE3] hover:text-[#063B8F] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  {industry}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Services behind the work */}
      <section className="border-t border-[#E2E8F0] bg-[#F7FAFC]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="From work to your project"
            title="Services Behind This Work"
            description="Every scenario above combines a small set of core TECH360 engineering services."
          />
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.slice(0, 3).map((s) => {
              const sImg = getServiceImage(s.slug);
              return (
                <ServiceCard
                  key={s.slug}
                  id={s.slug}
                  title={s.title}
                  tagline={s.tagline}
                  description={s.problem}
                  imageSrc={serviceImageSrc(s.slug)}
                  imageAlt={serviceImageAlt(s.slug, s.title)}
                  href={`/services/${s.slug}`}
                  category={sImg?.category}
                  icon={s.icon}
                  badges={s.tech.slice(0, 2)}
                  ctaLabel="Explore service"
                />
              );
            })}
          </div>
        </div>
      </section>

      <CtaBand
        title="Don’t see your exact system?"
        description="Most engagements combine several of these patterns. Send a short brief and we will document the proposed scope, milestones and any preview in writing."
      />
    </div>
  );
}
