"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { SERVICES } from "@/data/site";
import {
  getServiceImage,
  serviceImageAlt,
  serviceImageSrc,
} from "@/data/service-images";
import { PageHero } from "./PageHero";
import { RevealItem, RevealList } from "./Reveal";
import { ServiceCard } from "./ServiceCard";
import { CtaBand } from "./CtaBand";
import { SOLUTIONS_MEGA_COLUMNS } from "./nav-structure";

const PILLAR_BY_SLUG: Record<string, { id: string; heading: string }> =
  Object.fromEntries(
    SOLUTIONS_MEGA_COLUMNS.flatMap((col) =>
      col.items.map((item) => [
        item.href.replace(/^#?\/services\//, ""),
        { id: col.id, heading: col.heading },
      ])
    )
  );

export function ServicesView() {
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SERVICES.filter((s) => {
      if (pillar !== "all" && PILLAR_BY_SLUG[s.slug]?.id !== pillar) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q) ||
        s.problem.toLowerCase().includes(q) ||
        s.solution.toLowerCase().includes(q) ||
        s.tech.some((t) => t.toLowerCase().includes(q)) ||
        s.features.some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [query, pillar]);

  return (
    <div>
      <PageHero
        eyebrow="Solutions · 21 Services"
        title="Software, Automation & Platforms — Scoped Around Your Workflow"
        description="Every service below maps to its own dedicated architecture, written Scope of Work, interactive HTML preview before production engineering, and clean source-code handover."
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Pillar Filter + Search Toolbar */}
        <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-md">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#64748B]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 21 services by capability, workflow, or stack…"
                aria-label="Search services"
                className="min-h-11 w-full rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-9 text-sm text-[#0B1F33] placeholder:text-[#94A3B8] focus:border-[#009FE3] focus:outline-none focus:ring-2 focus:ring-[#009FE3]/25"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#64748B] hover:text-[#0B1F33]"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <p className="text-xs font-medium text-[#526173]" role="status">
              Showing{" "}
              <strong className="font-semibold text-[#0B1F33]">
                {filtered.length}
              </strong>{" "}
              of {SERVICES.length} services
            </p>
          </div>

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filter services by solution pillar"
          >
            <button
              type="button"
              aria-pressed={pillar === "all"}
              onClick={() => setPillar("all")}
              className={`min-h-9 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                pillar === "all"
                  ? "bg-[#063B8F] text-white"
                  : "border border-[#CBD5E1] bg-white text-[#334155] hover:border-[#009FE3]"
              }`}
            >
              All ({SERVICES.length})
            </button>
            {SOLUTIONS_MEGA_COLUMNS.map((col) => (
              <button
                key={col.id}
                type="button"
                aria-pressed={pillar === col.id}
                onClick={() => setPillar(col.id)}
                className={`min-h-9 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  pillar === col.id
                    ? "bg-[#063B8F] text-white"
                    : "border border-[#CBD5E1] bg-white text-[#334155] hover:border-[#009FE3]"
                }`}
              >
                {col.heading} ({col.items.length})
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-10 text-center">
            <p className="text-base font-semibold text-[#0B1F33]">
              No services match that search.
            </p>
            <p className="mt-1 text-sm text-[#526173]">
              Try clearing the filter or{" "}
              <a
                href="/contact"
                className="font-semibold text-[#0079AC] underline"
              >
                describe your project directly
              </a>
              .
            </p>
          </div>
        ) : (
          <RevealList className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((service, index) => {
              const imgMeta = getServiceImage(service.slug);
              const category =
                imgMeta?.category ?? PILLAR_BY_SLUG[service.slug]?.heading;
              return (
                <RevealItem key={service.slug} className="h-full">
                  <ServiceCard
                    id={service.slug}
                    title={service.title}
                    tagline={service.tagline}
                    description={service.problem}
                    imageSrc={serviceImageSrc(service.slug)}
                    imageAlt={serviceImageAlt(service.slug, service.title)}
                    href={`/services/${service.slug}`}
                    category={category}
                    icon={service.icon}
                    badges={service.tech.slice(0, 2)}
                    ctaLabel="View service detail"
                    eager={index < 3}
                  />
                </RevealItem>
              );
            })}
          </RevealList>
        )}
      </section>

      <CtaBand
        title="Not sure which service fits?"
        description="Tell us what your team does manually today — we will recommend the simplest system that removes the bottleneck."
      />
    </div>
  );
}

export default ServicesView;
