"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Gauge, Info, Layers, Target } from "lucide-react";

import { CASE_STUDIES, getService } from "@/data/site";
import { portfolioIndustryLink } from "@/lib/portfolio/industry-links";
import { BLUEPRINT_DETAIL_NOTICE, getBlueprintDetail } from "@/data/blueprint-details";
import {
  KIND_LABEL,
  adjacentPortfolio,
  getPortfolioEntry,
  relatedPortfolio,
} from "@/data/portfolio";
import { WORK_EXAMPLES } from "@/data/work-examples";
import { MediaGallery, ProvenanceBadge, ShareBar } from "./PortfolioMedia";
import { PortfolioCard } from "./PortfolioCard";
import { CtaBand } from "./CtaBand";

function stripPrefix(text: string) {
  return text.replace(/^(Illustrative scenario|Possible approach|Intended outcome, not a measured result):\s*/i, "");
}

/**
 * Dedicated delivery-blueprint page: /work/case-studies/<slug>.
 *
 * Structure follows the long-form client-story pattern (hero → at a glance →
 * challenge → approach → workflow → media → outcome → related → next), with
 * one deliberate difference: instead of a metrics "results" block, the page
 * shows a measurement plan, because these are illustrative scenarios.
 */
export default function BlueprintDetailView({ slug }: { slug: string }) {
  const study = CASE_STUDIES.find((item) => item.slug === slug);
  const detail = getBlueprintDetail(slug);
  const entry = getPortfolioEntry("blueprint", slug);

  if (!study || !detail || !entry) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-[#F7FAFC] px-5 py-20">
        <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#009FE3]">404 · Blueprint not found</p>
          <h1 className="mt-4 text-2xl font-bold text-[#0B1F33]">This delivery blueprint does not exist.</h1>
          <a href="/work/case-studies" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#063B8F] px-5 text-sm font-semibold text-white outline-none hover:bg-[#052f72] focus-visible:ring-2 focus-visible:ring-[#009FE3]">
            All delivery blueprints
          </a>
        </div>
      </div>
    );
  }

  const industry = portfolioIndustryLink(detail.industrySlug);
  const project = WORK_EXAMPLES.find((item) => item.slug === detail.relatedProject);
  const related = relatedPortfolio(entry, 3);
  const { previous, next } = adjacentPortfolio(entry);
  const path = entry.href;

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#061528]" aria-labelledby="blueprint-title">
        <img
          src={entry.cover.src}
          alt=""
          aria-hidden="true"
          width={entry.cover.width}
          height={entry.cover.height}
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover opacity-45"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#061528] via-[#061528]/85 to-[#061528]/30" />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/60">
              <li><a href="/" className="outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">Home</a></li>
              <li className="flex items-center gap-1.5"><ArrowRight className="size-3.5 opacity-50" aria-hidden="true" /><a href="/work" className="outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">Work</a></li>
              <li className="flex items-center gap-1.5"><ArrowRight className="size-3.5 opacity-50" aria-hidden="true" /><a href="/work/case-studies" className="outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">Delivery blueprints</a></li>
              <li className="flex items-center gap-1.5"><ArrowRight className="size-3.5 opacity-50" aria-hidden="true" /><span aria-current="page" className="text-white/90">{study.industry}</span></li>
            </ol>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#009FE3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#04121F]">
              {KIND_LABEL.blueprint.singular}
            </span>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#CFE9F7]">
              {entry.industry}
            </span>
            <ProvenanceBadge provenance="concept-artwork" />
          </div>
          <h1 id="blueprint-title" className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {study.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">{detail.context}</p>
          <div className="mt-8">
            <ShareBar title={study.title} path={path} />
          </div>
        </div>
      </section>

      {/* Honesty banner */}
      <div className="border-b border-[#F5B301]/30 bg-[#FFFBEB]">
        <div className="mx-auto flex w-full max-w-7xl items-start gap-2 px-4 py-3 text-xs leading-relaxed text-[#7A5B00] sm:px-6 lg:px-8">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p><strong>How to read this page:</strong> {BLUEPRINT_DETAIL_NOTICE}</p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8 lg:py-16">
        <div className="space-y-14">
          {/* Challenge & approach */}
          <section aria-labelledby="challenge-heading" className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B4472A]">
                <Target className="size-4" aria-hidden="true" /> The challenge
              </p>
              <h2 id="challenge-heading" className="mt-3 text-xl font-bold text-[#0B1F33]">What slows the team down today</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#526173]">{stripPrefix(study.challenge)}</p>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#009FE3]">
                <Layers className="size-4" aria-hidden="true" /> The approach
              </p>
              <h2 className="mt-3 text-xl font-bold text-[#0B1F33]">How TECH360 would structure it</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#526173]">{stripPrefix(study.approach)}</p>
            </div>
          </section>

          {/* Workflow */}
          <section aria-labelledby="workflow-heading">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#009FE3]">Operating workflow</p>
            <h2 id="workflow-heading" className="mt-2 text-2xl font-bold tracking-tight text-[#0B1F33]">Four stages, one auditable record</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {detail.stages.map((stage, index) => (
                <li key={stage.title} className="relative rounded-2xl border border-[#E2E8F0] bg-white p-5">
                  <span className={`grid size-9 place-items-center rounded-full text-xs font-bold text-white ${index === detail.stages.length - 1 ? "bg-[#18B83A]" : "bg-[#009FE3]"}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-4 text-base font-semibold text-[#0B1F33]">{stage.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#526173]">{stage.description}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Media */}
          <section aria-labelledby="media-heading">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#009FE3]">Media</p>
            <h2 id="media-heading" className="mt-2 text-2xl font-bold tracking-tight text-[#0B1F33]">Motion preview, setting and architecture</h2>
            <p className="mt-2 text-sm text-[#526173]">
              Every item is labelled with how it was made. None of it is footage or a screenshot of a client system.
            </p>
            <div className="mt-6">
              <MediaGallery images={entry.gallery} video={entry.video} title={study.title} />
            </div>
          </section>

          {/* Outcome + measurement */}
          <section aria-labelledby="outcome-heading" className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[#18B83A]/30 bg-[#18B83A]/[0.06] p-6">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#15803D]">
                <CheckCircle2 className="size-4" aria-hidden="true" /> Intended outcome
              </p>
              <h2 id="outcome-heading" className="mt-3 text-xl font-bold text-[#0B1F33]">What the system is designed to change</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#334155]">{stripPrefix(study.outcome)}</p>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#063B8F]">
                <Gauge className="size-4" aria-hidden="true" /> Measurement plan
              </p>
              <h2 className="mt-3 text-xl font-bold text-[#0B1F33]">How results would be proven</h2>
              <ul className="mt-3 space-y-2.5">
                {detail.measurementPlan.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-[#526173]">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#009FE3]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Assumptions */}
          <section aria-labelledby="assumptions-heading" className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#526173]">
              <ClipboardList className="size-4" aria-hidden="true" /> Assumptions & dependencies
            </p>
            <h2 id="assumptions-heading" className="sr-only">Assumptions and dependencies</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {detail.assumptions.map((item) => (
                <li key={item} className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-sm text-[#334155]">{item}</li>
              ))}
            </ul>
          </section>
        </div>

        {/* At a glance */}
        <aside aria-label="At a glance" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8A9AAB]">At a glance</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-[#8A9AAB]">Engagement type</dt>
                <dd className="mt-0.5 font-semibold text-[#0B1F33]">Illustrative delivery blueprint</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#8A9AAB]">Industry</dt>
                <dd className="mt-0.5 font-semibold text-[#0B1F33]">
                  {industry && !industry.substituted ? (
                    <a href={industry.href} className="text-[#063B8F] underline decoration-[#009FE3]/40 underline-offset-2 hover:text-[#009FE3]">
                      {industry.title}
                    </a>
                  ) : industry ? (
                    <>
                      {entry.industry}
                      <span className="block text-xs font-normal text-[#526173]">
                        Sector page:{" "}
                        <a href={industry.href} className="font-semibold text-[#063B8F] underline decoration-[#009FE3]/40 underline-offset-2 hover:text-[#009FE3]">
                          {industry.title}
                        </a>
                      </span>
                    </>
                  ) : (
                    entry.industry
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#8A9AAB]">Capabilities</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {entry.capabilities.map((capability) => (
                    <a
                      key={capability}
                      href={`/work?capability=${encodeURIComponent(capability)}`}
                      className="rounded-full border border-[#E2E8F0] px-2.5 py-0.5 text-xs font-medium text-[#334155] hover:border-[#009FE3] hover:text-[#063B8F]"
                    >
                      {capability}
                    </a>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#8A9AAB]">Typical stack</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {study.stack.map((tech) => (
                    <span key={tech} className="rounded-md bg-[#F1F6FB] px-2 py-0.5 text-xs font-medium text-[#334155]">{tech}</span>
                  ))}
                </dd>
              </div>
              {entry.deliveryWeeks ? (
                <div>
                  <dt className="text-xs font-semibold text-[#8A9AAB]">Indicative build window</dt>
                  <dd className="mt-0.5 font-semibold text-[#0B1F33]">{entry.deliveryWeeks}</dd>
                  <dd className="text-xs text-[#8A9AAB]">Planning estimate; confirmed after written scope.</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-semibold text-[#8A9AAB]">Services involved</dt>
                <dd className="mt-1">
                  <ul className="space-y-1">
                    {detail.relatedServices.map((serviceSlug) => {
                      const service = getService(serviceSlug);
                      return service ? (
                        <li key={serviceSlug}>
                          <a href={`/services/${serviceSlug}`} className="text-sm font-medium text-[#063B8F] hover:text-[#009FE3]">
                            {service.title} →
                          </a>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </dd>
              </div>
            </dl>
            <a
              href="/contact"
              className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#063B8F] px-4 text-sm font-semibold text-white outline-none hover:bg-[#052f72] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
            >
              Scope a similar system
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            {project ? (
              <a
                href={`/work/projects/${project.slug}`}
                className="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg border border-[#E2E8F0] px-4 text-sm font-semibold text-[#063B8F] outline-none hover:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
              >
                See the {project.name} specification
              </a>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Related */}
      <section aria-labelledby="related-heading" className="border-t border-[#E2E8F0] bg-[#F7FAFC]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 id="related-heading" className="text-2xl font-bold tracking-tight text-[#0B1F33]">Related work</h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={`${item.kind}-${item.slug}`}>
                <PortfolioCard entry={item} />
              </li>
            ))}
          </ul>

          <nav aria-label="More delivery blueprints" className="mt-10 grid gap-4 sm:grid-cols-2">
            <a href={previous.href} className="group flex items-center gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 outline-none hover:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]">
              <ArrowLeft className="size-5 shrink-0 text-[#009FE3] transition-transform group-hover:-translate-x-1" aria-hidden="true" />
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A9AAB]">Previous blueprint</span>
                <span className="mt-0.5 block text-sm font-semibold text-[#0B1F33]">{previous.title}</span>
              </span>
            </a>
            <a href={next.href} className="group flex items-center justify-end gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 text-right outline-none hover:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]">
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A9AAB]">Next blueprint</span>
                <span className="mt-0.5 block text-sm font-semibold text-[#0B1F33]">{next.title}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-[#009FE3] transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </a>
          </nav>
        </div>
      </section>

      <CtaBand
        title="Have a workflow like this one?"
        description="Tell us where the process breaks today. We will document the scope, the measurement baseline and the milestones in writing before any build starts."
        primaryLabel="Discuss your workflow"
      />
    </div>
  );
}
