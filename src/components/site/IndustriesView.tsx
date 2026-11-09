"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { INDUSTRIES, getService } from "@/data/site";
import { imageFor } from "@/data/images";
import { industryImage, industryImageAlt } from "@/data/industry-images";
import { INDUSTRY_REGISTRY } from "@/data/industries";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { ImageView } from "./ImageView";
import { RevealList, RevealItem } from "./Reveal";

/** The five sectors the registry actually uses, in reading order. */
const SECTORS: { key: string; label: string; blurb: string }[] = [
  {
    key: "commerce-retail",
    label: "Commerce & Retail",
    blurb: "Catalogue, checkout, store operations and hospitality — where margin leaks between the systems.",
  },
  {
    key: "education-sector",
    label: "Education",
    blurb: "Admissions through assessment and alumni, with guardian and learner access kept separate.",
  },
  {
    key: "healthcare-sector",
    label: "Healthcare",
    blurb: "Patient access, clinical records and controlled consent — audited at every change.",
  },
  {
    key: "agency-professional",
    label: "Agencies & Professional Services",
    blurb: "Briefs, matters, utilisation and realisation for firms that sell expertise.",
  },
  {
    key: "finance-enterprise",
    label: "Finance & Enterprise",
    blurb: "Controls, reconciliation and multi-entity operations under a single reporting discipline.",
  },
  {
    key: "physical-operations",
    label: "Physical Operations",
    blurb: "Sites, fleets, plants and projects — the systems around things you can touch.",
  },
];

type SectorKey = string | "all";

export default function IndustriesView() {
  const [sector, setSector] = useState<SectorKey>("all");

  const registryBySlug = useMemo(
    () => new Map(INDUSTRY_REGISTRY.map((entry) => [entry.slug, entry])),
    []
  );

  const visible = useMemo(
    () =>
      INDUSTRIES.filter((industry) => {
        if (sector === "all") return true;
        return registryBySlug.get(industry.slug)?.category === sector;
      }),
    [sector, registryBySlug]
  );

  return (
    <div>
      <PageHero
        eyebrow="Industries"
        title="Twenty industries. Sector-specific patterns, not templates."
        description="Each industry page starts from the workflows your sector knows by name — departments, roles, data entities and the approval points that matter — then shows how the system is engineered around them."
        breadcrumb={[{ label: "Industries" }]}
      />

      <section
        aria-labelledby="industry-filters-heading"
        className="border-b border-[#E2E8F0] bg-white py-8"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="industry-filters-heading" className="sr-only">
            Filter industries by sector
          </h2>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#007da8]">
            Find your sector
          </p>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Industry sectors">
            <SectorButton
              active={sector === "all"}
              onClick={() => setSector("all")}
              label={`All industries (${INDUSTRIES.length})`}
            />
            {SECTORS.map((entry) => {
              const count = INDUSTRIES.filter(
                (industry) => registryBySlug.get(industry.slug)?.category === entry.key
              ).length;
              if (count === 0) return null;
              return (
                <SectorButton
                  key={entry.key}
                  active={sector === entry.key}
                  onClick={() => setSector(entry.key)}
                  label={`${entry.label} (${count})`}
                />
              );
            })}
          </div>
          <p className="mt-3 text-sm text-[#526173]" role="status">
            {sector === "all"
              ? `Showing all ${visible.length} industries.`
              : `Showing ${visible.length} ${SECTORS.find((s) => s.key === sector)?.label ?? ""} industries.`}
          </p>
        </div>
      </section>

      <section aria-labelledby="industry-grid-heading" className="bg-[#F4FAFF]">
        <h2 id="industry-grid-heading" className="sr-only">
          All industries
        </h2>
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#007da8]">
                Sector blueprints
              </p>
              <h2 className="mt-3 text-2xl font-bold text-[#0B1F33] sm:text-3xl">
                Explore our industry focus
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#526173]">
                Every page lists the department model, role permissions, module set and the approval
                points that shape delivery. Exact features are always confirmed in a written Scope of
                Work.
              </p>
            </div>
            <p className="text-xs text-[#526173]">
              Hero images are architecture diagrams generated for this site — not photographs of
              customers or institutions.
            </p>
          </div>

          <RevealList className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((industry) => {
              const entry = registryBySlug.get(industry.slug);
              const sectorLabel = SECTORS.find((s) => s.key === entry?.category)?.label;
              return (
                <RevealItem key={industry.slug}>
                  <a
                    href={`#/industries/${industry.slug}`}
                    className="group block h-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(6,59,143,0.12)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                  >
                    <div className="relative">
                      <ImageView
                        src={industryImage(industry.slug) ?? imageFor(industry.imageKey)}
                        alt={industryImageAlt(industry.title)}
                        aspect="16/10"
                        imgClassName="transition-transform duration-500 group-hover:scale-105"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-[#0B1F33]/55 via-transparent to-transparent"
                      />
                      {sectorLabel ? (
                        <span className="absolute left-4 top-4 rounded-full border border-white/30 bg-[#0B1F33]/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                          {sectorLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex min-h-52 flex-col p-5">
                      <h3 className="text-lg font-bold text-[#0B1F33]">
                        {entry?.name ?? industry.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#526173]">
                        {entry ? entry.data.hero.subhead : industry.description}
                      </p>
                      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[#E2E8F0] pt-3 text-xs">
                        <div>
                          <dt className="text-[#526173]">Workflows</dt>
                          <dd className="font-bold text-[#0B1F33]">{entry?.data.workflows.length ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-[#526173]">Modules</dt>
                          <dd className="font-bold text-[#0B1F33]">{entry?.data.modules.length ?? "—"}</dd>
                        </div>
                      </dl>
                      <p className="mt-4 text-xs leading-relaxed text-[#526173]">
                        <span className="font-semibold text-[#0B1F33]">Services: </span>
                        {industry.recommended
                          .map(getService)
                          .filter((service): service is NonNullable<typeof service> => Boolean(service))
                          .slice(0, 2)
                          .map((service) => service.title)
                          .join(" · ")}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-[#0079a6]">
                        Explore industry
                        <ArrowRight
                          className="size-4 transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </a>
                </RevealItem>
              );
            })}
          </RevealList>

          <div className="mt-10 text-center">
            <a
              href="#/contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#063B8F]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#063B8F] outline-none transition-colors hover:border-[#009FE3] hover:text-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
            >
              Don&apos;t see your sector? Ask us
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <CtaBand
        title="Your industry, scoped properly"
        description="Tell us your sector and requirements. We prepare a written proposal and scope; an HTML Preview is included where agreed, before the applicable payment."
      />
    </div>
  );
}

function SectorButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-10 items-center rounded-lg px-3.5 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 ${
        active
          ? "bg-[#063B8F] text-white"
          : "border border-[#E2E8F0] bg-white text-[#0B1F33] hover:border-[#009FE3]/50 hover:text-[#063B8F]"
      }`}
    >
      {label}
    </button>
  );
}
