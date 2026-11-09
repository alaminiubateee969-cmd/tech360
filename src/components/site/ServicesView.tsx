"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SERVICES, type Service } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { Icon } from "./icons";
import { ImageView } from "./ImageView";
import { FeaturesModulesDiagram } from "./diagrams";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { SOLUTIONS_MEGA_COLUMNS } from "./nav-structure";

/**
 * The services catalogue mirrors the four Solutions pillars used by the header
 * mega-menu (SOLUTIONS_MEGA_COLUMNS), so the grouping a buyer sees in
 * navigation is exactly the grouping they get on /services. Coverage is
 * asserted by tests/service-pillars.test.ts: 4 pillars, 21 services, no gaps.
 */
const PILLAR_BLURBS: Record<string, string> = {
  "ai-solutions": "Human-approved assistants and automation that read and write your real systems.",
  "software-products": "Software you own: storefronts, portals, dashboards and internal tools.",
  "crm-automation": "One Client ID behind every message, with follow-up that never double-sends.",
  "engineering-services": "Fast websites, integrations, cloud deployment and ongoing care.",
};

const PILLARS = SOLUTIONS_MEGA_COLUMNS.map((col) => ({
  id: col.id,
  name: col.heading,
  blurb: PILLAR_BLURBS[col.id] ?? col.description,
  slugs: col.items.map((item) => item.href.replace(/^#?\/services\//, "")),
}));

function ServiceCard({ service }: { service: Service }) {
  return (
    <a
      href={`/services/${service.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 hover:shadow-[0_12px_32px_rgba(6,59,143,0.1)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
    >
      <ImageView
        src="/images/services-workspace.jpg"
        alt={`${service.title} — workspace illustration`}
        aspect="16/9"
        imgClassName="transition-transform duration-500 group-hover:scale-105"
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#009FE3] transition-colors group-hover:bg-[#009FE3] group-hover:text-white">
            <Icon name={service.icon} className="size-5" />
          </span>
          <span className="rounded-md border border-[#E2E8F0] bg-[#F4FAFF] px-2 py-1 text-[11px] font-medium text-[#526173]">
            {service.tech.slice(0, 2).join(" · ")}
          </span>
        </div>
        <h3 className="mt-5 text-lg font-semibold text-[#0B1F33]">{service.title}</h3>
        <p className="mt-1 text-sm font-medium text-[#009FE3]">{service.tagline}</p>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-[#526173]">
          {service.problem}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {service.features.slice(0, 3).map((f) => (
            <span
              key={f}
              className="line-clamp-1 rounded-md bg-[#F4FAFF] px-2 py-1 text-[11px] font-medium text-[#526173]"
            >
              {f}
            </span>
          ))}
          {service.features.length > 3 ? (
            <span className="rounded-md bg-[#F4FAFF] px-2 py-1 text-[11px] font-semibold text-[#009FE3]">
              +{service.features.length - 3} more
            </span>
          ) : null}
        </div>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#009FE3]">
          Service detail
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}

export default function ServicesView() {
  // Client-side search across the catalogue (title, tagline, problem, technology).
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState<string>("all");
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const visiblePillars = pillar === "all" ? PILLARS : PILLARS.filter((p) => p.id === pillar);

  const matches = useMemo(() => {
    if (!q) return SERVICES;
    return SERVICES.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q) ||
        s.problem.toLowerCase().includes(q) ||
        s.tech.some((t) => t.toLowerCase().includes(q)),
    );
  }, [q]);

  return (
    <div>
      <PageHero
        eyebrow="Services"
        title={`${SERVICES.length} engineering services. One delivery standard.`}
        description="From websites to AI-assisted automation — scoped in writing, with previews, source code, and handover provided as agreed for each project."
        breadcrumb={[{ label: "Services" }]}
      />

      {/* search across every service */}
      <section aria-label="Service search" className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-md" role="search" aria-label="Search services">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#7A8CA0]" aria-hidden="true" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services — WhatsApp, dashboard, deployment…"
                aria-label="Search services by name or technology"
                className="h-11 rounded-lg border-[#E2E8F0] bg-white pl-10 text-sm text-[#0B1F33] placeholder:text-[#7A8CA0] focus-visible:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]/25"
              />
            </div>
            <p className={cn("text-xs text-[#7A8CA0]", !searching && "sm:ml-1")} aria-live="polite">
              {searching
                ? `${matches.length} of ${SERVICES.length} services match “${query.trim()}”`
                : `${SERVICES.length} services · grouped by discipline below`}
            </p>
            {searching ? (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto min-h-9 rounded-lg"
                onClick={() => setQuery("")}
              >
                Clear search
              </Button>
            ) : null}
          </div>

          {/* Four-pillar filter — same grouping as the Solutions mega-menu */}
          <div
            role="group"
            aria-label="Filter services by solution pillar"
            className="mt-6 flex flex-wrap gap-2"
          >
            <button
              type="button"
              onClick={() => setPillar("all")}
              aria-pressed={pillar === "all"}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2",
                pillar === "all"
                  ? "border-[#009FE3] bg-[#009FE3] text-white"
                  : "border-[#E2E8F0] bg-white text-[#0B1F33] hover:border-[#009FE3]/50 hover:text-[#0079AC]",
              )}
            >
              All services
              <span className={cn("text-xs font-bold", pillar === "all" ? "text-white/80" : "text-[#7A8CA0]")}>
                {SERVICES.length}
              </span>
            </button>
            {PILLARS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPillar(p.id)}
                aria-pressed={pillar === p.id}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2",
                  pillar === p.id
                    ? "border-[#009FE3] bg-[#009FE3] text-white"
                    : "border-[#E2E8F0] bg-white text-[#0B1F33] hover:border-[#009FE3]/50 hover:text-[#0079AC]",
                )}
              >
                {p.name}
                <span className={cn("text-xs font-bold", pillar === p.id ? "text-white/80" : "text-[#7A8CA0]")}>
                  {p.slugs.length}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#7A8CA0]" role="status">
            {pillar === "all"
              ? `Showing all ${SERVICES.length} services across four pillars.`
              : `Showing ${visiblePillars[0]?.slugs.length ?? 0} services in ${visiblePillars[0]?.name ?? ""}.`}
          </p>
        </div>
      </section>

      {searching ? (
        <section aria-labelledby="search-results-heading" className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 id="search-results-heading" className="sr-only">Search results</h2>
            {matches.length > 0 ? (
              <RevealList className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {matches.map((service) => (
                  <RevealItem key={service.slug} className="h-full">
                    <ServiceCard service={service} />
                  </RevealItem>
                ))}
              </RevealList>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F4FAFF] px-6 py-14 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-[#009FE3]/10" aria-hidden="true">
                  <SearchX className="size-5 text-[#009FE3]" />
                </span>
                <p className="text-sm font-semibold text-[#0B1F33]">No services match “{query.trim()}”</p>
                <p className="max-w-sm text-xs leading-relaxed text-[#526173]">
                  Try a broader keyword, or tell us what you need — custom builds are a service too.
                </p>
                <a
                  href="/contact"
                  className="mt-1 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#009FE3] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0090CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
                >
                  Describe your need
                </a>
              </div>
            )}
          </div>
        </section>
      ) : (
        <>
      {visiblePillars.map((group) => {
        const services = group.slugs
          .map((slug) => SERVICES.find((s) => s.slug === slug))
          .filter((s): s is Service => Boolean(s));
        return (
          <section
            key={group.name}
            aria-labelledby={`group-${group.name.replace(/[^a-z]/gi, "-").toLowerCase()}`}
            className="border-b border-[#E2E8F0] bg-white last:border-b-0"
          >
            <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
              <SectionHeading
                eyebrow={`${services.length} services`}
                title={group.name}
                description={group.blurb}
                align="left"
                className="max-w-2xl"
              />
              <RevealList className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {services.map((service) => (
                  <RevealItem key={service.slug} className="h-full">
                    <ServiceCard service={service} />
                  </RevealItem>
                ))}
              </RevealList>
            </div>
          </section>
        );
      })}
        </>
      )}

      {/* How engagement starts */}
      <section className="bg-[#F4FAFF]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8">
          <Reveal>
            <FeaturesModulesDiagram />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="text-center lg:text-left">
              <h2 className="text-2xl font-bold tracking-tight text-[#0B1F33] sm:text-3xl">
                Not sure which service you need?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[#526173] lg:mx-0">
                That is what discovery is for. Send one message about your
                business and your goal — the recommended scope comes back in
                writing, and you decide with a preview in hand.
              </p>
              <a
                href="/contact"
                className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#009FE3] px-6 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0090CC] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
              >
                Get a scoped recommendation
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
