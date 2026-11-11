"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { CASE_STUDIES, SERVICES, type CaseStudy } from "@/data/site";
import {
  getCaseStudyImage,
  getServiceImage,
  serviceImageAlt,
  serviceImageSrc,
} from "@/data/service-images";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PageHero } from "./PageHero";
import { SectionHeading } from "./SectionHeading";
import { ImageView } from "./ImageView";
import { ServiceCard } from "./ServiceCard";
import { RevealItem, RevealList } from "./Reveal";
import { CtaBand } from "./CtaBand";
import { PrimaryLink } from "./buttons";
import { WorkExamples } from "./WorkExamples";

export type WorkViewVariant = "all" | "projects" | "case-studies";

const HERO_COPY: Record<
  WorkViewVariant,
  { eyebrow: string; title: string; description: string }
> = {
  all: {
    eyebrow: "Work & Blueprints",
    title: "Representative Systems & Delivery Blueprints",
    description:
      "Illustrative system scenarios and architectural blueprints across eight industries — showing the operational problem, the system built, and the expected day-to-day outcome. None of these are presented as named customer endorsements.",
  },
  projects: {
    eyebrow: "Projects & System Scenarios",
    title: "Systems We Design, Build & Hand Over",
    description:
      "Twelve illustrative system architectures — corporate websites, client portals, CRM consoles, commerce checkouts, and AI-assisted workflows — showing how Tech360 structures real software.",
  },
  "case-studies": {
    eyebrow: "Delivery Blueprints",
    title: "Problem → Architecture → Operational Outcome",
    description:
      "Eight industry delivery blueprints illustrating how fragmented manual processes are replaced by scoped, auditable software systems.",
  },
};

export default function WorkView({
  variant,
  subView,
}: {
  variant?: WorkViewVariant;
  subView?: string;
}) {
  const resolvedVariant: WorkViewVariant =
    variant ??
    (subView === "projects" || subView === "case-studies" ? subView : "all");
  const industries = useMemo(
    () => ["All", ...Array.from(new Set(CASE_STUDIES.map((c) => c.industry)))],
    []
  );
  const [filter, setFilter] = useState("All");
  const [active, setActive] = useState<CaseStudy | null>(null);

  const visible = useMemo(
    () =>
      filter === "All"
        ? CASE_STUDIES
        : CASE_STUDIES.filter((c) => c.industry === filter),
    [filter]
  );

  const hero = HERO_COPY[resolvedVariant];
  const showWorkExamples = resolvedVariant === "all" || resolvedVariant === "projects";
  const showBlueprints = resolvedVariant === "all" || resolvedVariant === "case-studies";

  return (
    <div>
      <PageHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        description={hero.description}
      />

      {/* Sub-navigation between Work views */}
      <div className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <nav aria-label="Work sections" className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: "Overview", href: "/work" },
                { id: "projects", label: "System Scenarios", href: "/work/projects" },
                { id: "case-studies", label: "Delivery Blueprints", href: "/work/case-studies" },
              ] as const
            ).map((tab) => (
              <a
                key={tab.id}
                href={tab.href}
                aria-current={resolvedVariant === tab.id ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  resolvedVariant === tab.id
                    ? "bg-[#063B8F] text-white"
                    : "border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:border-[#009FE3] hover:text-[#063B8F]"
                )}
              >
                {tab.label}
              </a>
            ))}
          </nav>
          <p className="text-xs text-[#64748B]">
            Note: Illustrative engineering scenarios — client-confidential deployments are shared privately on request.
          </p>
        </div>
      </div>

      {/* 12 System Scenarios */}
      {showWorkExamples ? <WorkExamples /> : null}

      {/* 8 Industry Delivery Blueprints */}
      {showBlueprints ? (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Industry Delivery Blueprints"
            title="How Operational Bottlenecks Turn Into Clean Software"
            description="Filter by sector and click any blueprint card to inspect the problem, architecture, stack, and operational outcome."
          />

          <div
            role="tablist"
            aria-label="Filter blueprints by industry"
            className="mt-10 flex flex-wrap justify-center gap-2"
          >
            {industries.map((ind) => {
              const selected = filter === ind;
              return (
                <button
                  key={ind}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(ind)}
                  className={cn(
                    "min-h-10 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                    selected
                      ? "bg-[#063B8F] text-white"
                      : "border border-[#E2E8F0] bg-white text-[#526173] hover:border-[#009FE3] hover:text-[#0B1F33]"
                  )}
                >
                  {ind}
                </button>
              );
            })}
          </div>

          <RevealList
            key={filter}
            className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {visible.map((c, idx) => {
              const visual = getCaseStudyImage(c.slug);
              return (
                <RevealItem key={c.slug} className="h-full">
                  <button
                    type="button"
                    onClick={() => setActive(c)}
                    className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <div className="relative w-full overflow-hidden border-b border-[#E2E8F0] bg-[#061528]">
                      <ImageView
                        src={visual?.src}
                        alt={visual?.alt ?? `${c.title} — illustrative delivery blueprint`}
                        aspect="16/10"
                        width={1600}
                        height={1000}
                        eager={idx < 3 && !showWorkExamples}
                        sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                        imgClassName="transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#040E1C]/60 to-transparent" />
                      <span className="absolute left-3.5 top-3.5 rounded-full border border-white/20 bg-[#061528]/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#9BEBFF] backdrop-blur-sm">
                        {c.industry}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#0079AC]">
                          Blueprint
                        </span>
                        <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-medium text-[#64748B]">
                          Illustrative
                        </span>
                      </div>
                      <h3 className="mt-2.5 text-lg font-bold text-[#0B1F33] group-hover:text-[#063B8F]">
                        {c.title}
                      </h3>
                      <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[#526173]">
                        {c.challenge}
                      </p>
                      <div className="mt-5 rounded-xl border border-[#18B83A]/25 bg-[#18B83A]/[0.06] px-3.5 py-2.5 text-xs font-semibold text-[#0B1F33]">
                        Target outcome: {c.outcome}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {c.stack.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-[#F7FAFC] px-2.5 py-1 text-[11px] font-medium text-[#526173]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <span className="mt-5 inline-flex items-center gap-1.5 border-t border-[#F1F5F9] pt-4 text-xs font-semibold text-[#0079AC]">
                        Inspect blueprint
                        <ArrowRight
                          className="size-3.5 transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </button>
                </RevealItem>
              );
            })}
          </RevealList>
        </section>
      ) : null}

      {/* Services behind these blueprints */}
      <section className="border-t border-[#E2E8F0] bg-[#F7FAFC]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="From work to your project"
            title="Services Behind These Blueprints"
            description="Every system scenario above combines a small set of core Tech360 engineering services."
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

      <Dialog
        open={Boolean(active)}
        onOpenChange={(open) => !open && setActive(null)}
      >
        <DialogContent className="max-w-xl bg-white text-[#0B1F33]">
          {active ? (
            <>
              <DialogHeader>
                <span className="w-fit rounded-full bg-[#009FE3]/10 px-3 py-1 text-xs font-semibold text-[#0079AC]">
                  {active.industry} · Illustrative Blueprint
                </span>
                <DialogTitle className="pt-2 text-2xl font-bold text-[#0B1F33]">
                  {active.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Blueprint summary for {active.title}
                </DialogDescription>
              </DialogHeader>

              {getCaseStudyImage(active.slug) ? (
                <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#061528]">
                  <ImageView
                    src={getCaseStudyImage(active.slug)?.src}
                    alt={
                      getCaseStudyImage(active.slug)?.alt ??
                      `${active.title} blueprint`
                    }
                    aspect="16/10"
                    width={1600}
                    height={1000}
                    eager
                    sizes="560px"
                  />
                </div>
              ) : null}

              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#526173]">
                    Operational Challenge
                  </p>
                  <p className="mt-1 leading-relaxed text-[#0B1F33]">
                    {active.challenge}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#526173]">
                    Engineering Approach
                  </p>
                  <p className="mt-1 leading-relaxed text-[#0B1F33]">
                    {active.approach}
                  </p>
                </div>
                <div className="rounded-xl border border-[#18B83A]/30 bg-[#18B83A]/[0.07] p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#18B83A]">
                    Expected Outcome
                  </p>
                  <p className="mt-1 font-semibold text-[#0B1F33]">
                    {active.outcome}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#526173]">
                    Typical Stack
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {active.stack.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-[#E2E8F0] bg-[#F7FAFC] px-3 py-1 text-xs font-medium text-[#0B1F33]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <PrimaryLink
                  href="/contact"
                  onClick={() => setActive(null)}
                  className="w-full justify-center"
                >
                  Scope a Similar System
                  <ArrowRight className="size-4" aria-hidden="true" />
                </PrimaryLink>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <CtaBand />
    </div>
  );
}
