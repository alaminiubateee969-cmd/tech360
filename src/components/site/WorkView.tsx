"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CircleAlert, CheckCircle2, Compass, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CASE_STUDIES, SERVICES, type CaseStudy } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { WebsiteConceptMockup } from "./concepts";
import { CardLinkAffordance, PrimaryLink } from "./buttons";

/**
 * Expanded illustrative scenario detail — not an audited customer case study
 * or a claim that a particular engagement, stack, or outcome occurred.
 */
function CaseStudyDialog({
  study,
  open,
  onClose,
}: {
  study: CaseStudy | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!study || !open) return null;

  const phases = [
    { t: "Discovery", d: `Confirm business context and ${study.industry.toLowerCase()} constraints.` },
    { t: "Written scope", d: "Agree deliverables, milestones, and payment terms in writing." },
    { t: "Design & build", d: "Plan implementation iterations and progress reporting." },
    { t: "Preview gate", d: "Where included, review the agreed preview before the applicable payment milestone." },
    { t: "Verify", d: "Define and run the quality and security checks in the scope." },
    { t: "Launch & handover", d: "Plan deployment, ownership transfer, and documentation." },
    { t: "Support", d: "Set any post-launch support terms in a separate agreement." },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${study.title} — illustrative scenario detail`}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0B1F33]/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92svh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#E2E8F0] bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <Badge className="rounded-md bg-[#063B8F]/10 text-xs font-medium text-[#063B8F] hover:bg-[#063B8F]/10">
              {study.industry} · illustrative scenario
            </Badge>
            <h3 className="mt-2 text-lg font-bold leading-snug text-[#0B1F33] sm:text-xl">
              {study.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scenario detail"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#526173] outline-none transition-colors hover:bg-[#F4FAFF] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-6 sm:px-7">
          {/* Narrative */}
          <div className="space-y-5">
            {[
              ["Challenge", study.challenge, "#B4472A", CircleAlert],
              ["Approach", study.approach, "#063B8F", Compass],
              ["Intended outcome (illustrative)", study.outcome, "#18B83A", CheckCircle2],
            ].map(([label, text, color, IconC]) => {
              const IconComp = IconC as typeof CircleAlert;
              return (
              <div key={label as string} className="flex items-start gap-3.5">
                <span
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${color}14`, color: color as string }}
                >
                  <IconComp className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#526173]">
                    {label as string}
                  </h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#0B1F33]">{text as string}</p>
                </div>
              </div>
              );
            })}
          </div>

          {/* Delivery pattern */}
          <div className="mt-8 rounded-xl border border-[#E2E8F0] bg-[#F8FCFF] p-5">
            <h4 className="text-sm font-bold text-[#0B1F33]">Possible delivery checkpoints</h4>
            <p className="mt-1 text-xs leading-relaxed text-[#526173]">
              A real project may use checkpoints like these. Scope, approvals, timing, and support are agreed for each engagement; this example is not evidence of a completed delivery.
            </p>
            <ol className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {phases.map((p, i) => (
                <li key={p.t} className="flex items-start gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[#009FE3] bg-white text-[10px] font-bold text-[#009FE3]">
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-[#0B1F33]">{p.t}</span>
                    <span className="ml-1.5 text-[11px] leading-snug text-[#526173]">{p.d}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Stack */}
          <div className="mt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#526173]">Possible technology examples</h4>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {study.stack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-md border border-[#E2E8F0] bg-[#F4FAFF] px-2.5 py-1 text-[11px] font-medium text-[#526173]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 flex flex-col gap-3 rounded-xl bg-gradient-to-br from-[#063B8F] to-[#0B1F33] p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-white/85">
              <span className="font-semibold text-white">Discuss a similar requirement.</span>{" "}
              We will assess fit and scope; any client reference requires explicit permission and may not be available.
            </p>
            <PrimaryLink href="#/contact" className="shrink-0">
              Start your version
              <ArrowRight className="size-4" aria-hidden="true" />
            </PrimaryLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Honest showcase: a hand-coded illustrative design concept, not a customer
 * website, client screenshot, or evidence of a completed engagement.
 */
function ConceptShowcase() {
  return (
    <Reveal>
      <div className="mb-12">
        <WebsiteConceptMockup />
      </div>
    </Reveal>
  );
}

interface PublicReviewItem {
  id: string;
  name: string;
  businessName?: string | null;
  projectName?: string | null;
  rating: number;
  content: string;
  date: string;
}

/**
 * Client reviews on the Work page — only real, client-submitted, moderated,
 * consented reviews. When none exist yet we say so honestly instead of
 * fabricating testimonials.
 */
function WorkReviews() {
  const [reviews, setReviews] = useState<PublicReviewItem[] | null>(null);
  const [reviewLoadError, setReviewLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    fetch("/api/reviews", { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((json: { reviews?: PublicReviewItem[] }) => {
        if (active) setReviews(Array.isArray(json.reviews) ? json.reviews : []);
      })
      .catch(() => {
        if (active) {
          setReviews([]);
          setReviewLoadError(true);
        }
      });
    return () => {
      active = false;
      ctrl.abort();
    };
  }, []);

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");

  return (
    <section aria-labelledby="reviews-heading" className="bg-[#F4FAFF]">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="reviews-heading"
          eyebrow="Client feedback"
          title="Reviews approved for public display"
          description="The public feed includes reviews marked approved, published, and consented in the review system. The underlying live review records were not independently inspected in this audit."
        />

        {reviews === null ? (
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-[#E2E8F0] bg-white">
                <CardContent className="p-6">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : reviewLoadError ? (
          <Reveal>
            <div className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-xl border border-amber-200 bg-white p-5">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[#526173]">
                <span className="font-semibold text-[#0B1F33]">Client feedback could not be loaded.</span>{" "}
                No conclusion about published reviews can be made until the review service is available.
              </p>
            </div>
          </Reveal>
        ) : reviews.length === 0 ? (
          <Reveal>
            <div className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5">
              <Star className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[#526173]">
                <span className="font-semibold text-[#0B1F33]">No approved public reviews are available right now.</span>{" "}
                The feed displays only approved, published, consented reviews. Private or unpublished records, if any, are not shown here.
              </p>
            </div>
          </Reveal>
        ) : (
          <RevealList
            className={
              reviews.length === 1
                ? "mt-10 mx-auto grid max-w-xl grid-cols-1 gap-6"
                : reviews.length === 2
                  ? "mt-10 mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2"
                  : "mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
            }
          >
            {reviews.map((r) => (
              <RevealItem key={r.id} className="h-full">
                <Card className="relative flex h-full flex-col border-[#E2E8F0] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#18B83A]/40 hover:shadow-[0_12px_32px_rgba(24,184,58,0.08)]">
                  <CardContent className="flex h-full flex-col p-6">
                    <div className="flex items-center gap-1" aria-label={`${r.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`size-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-300"}`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-[#526173]">“{r.content}”</p>
                    <div className="mt-5 flex items-center gap-3 border-t border-[#E2E8F0] pt-4">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#009FE3] to-[#063B8F] text-sm font-bold text-white"
                        aria-hidden="true"
                      >
                        {initials(r.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0B1F33]">{r.name}</p>
                        <p className="truncate text-xs text-[#526173]">
                          {r.businessName ?? r.projectName ?? "Tech360 client"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </RevealList>
        )}
      </div>
    </section>
  );
}

export default function WorkView() {
  const [activeStudy, setActiveStudy] = useState<CaseStudy | null>(null);

  return (
    <main id="main-content">
      <PageHero
        eyebrow="Illustrative scenarios"
        title="Example project scenarios"
        description="These hypothetical examples show possible approaches across several industries. They are not verified client engagements, audited case studies, or measured outcomes."
        breadcrumb={[{ label: "Work" }]}
      />

      <section aria-labelledby="scenarios-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <Reveal>
            <div className="mb-10 flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5">
              <Compass className="mt-0.5 size-5 shrink-0 text-[#009FE3]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[#526173]">
                <span className="font-semibold text-[#0B1F33]">How to read these:</span>{" "}
                hypothetical scenarios with possible approaches and intended outcomes. No client relationship, implementation, technology deployment, reference, or result is asserted. Actual scope, integrations, and outcomes require validation for each engagement.
              </p>
            </div>
          </Reveal>

          <ConceptShowcase />

          <h2 id="scenarios-heading" className="sr-only">Illustrative scenario list</h2>
          <RevealList className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {CASE_STUDIES.map((study) => (
              <RevealItem key={study.slug} className="h-full">
                <Card className="flex h-full flex-col border-[#E2E8F0] bg-white text-left transition-all duration-300 hover:border-[#009FE3]/40 hover:shadow-[0_12px_32px_rgba(6,59,143,0.08)]">
                  <button
                    type="button"
                    onClick={() => setActiveStudy(study)}
                    aria-label={`Read the illustrative scenario: ${study.title}`}
                    className="flex h-full flex-col rounded-xl p-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] sm:p-7"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="rounded-md bg-[#063B8F]/10 text-xs font-medium text-[#063B8F] hover:bg-[#063B8F]/10">
                        {study.industry} · illustrative scenario
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold leading-snug text-[#0B1F33]">
                      {study.title}
                    </h3>

                    <div className="mt-5 flex-1 space-y-4">
                      <div className="flex items-start gap-3">
                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#B4472A]" aria-hidden="true" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#526173]">
                            Challenge
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-[#526173]">
                            {study.challenge}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Compass className="mt-0.5 size-4 shrink-0 text-[#063B8F]" aria-hidden="true" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#526173]">
                            Approach
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-[#526173]">
                            {study.approach}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#526173]">
                            Intended outcome (illustrative)
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-[#526173]">
                            {study.outcome}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-1.5 border-t border-[#E2E8F0] pt-5">
                      {study.stack.slice(0, 4).map((tech) => (
                        <span
                          key={tech}
                          className="rounded-md border border-[#E2E8F0] bg-[#F4FAFF] px-2 py-1 text-[11px] font-medium text-[#526173]"
                        >
                          {tech}
                        </span>
                      ))}
                      {study.stack.length > 4 && (
                        <span className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-medium text-[#009FE3]">
                          +{study.stack.length - 4} more
                        </span>
                      )}
                    </div>
                    <CardLinkAffordance className="mt-4">
                      Read scenario
                    </CardLinkAffordance>
                  </button>
                </Card>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      {/* Client reviews — REAL published reviews only, honest empty state otherwise */}
      <WorkReviews />

      {/* From work to your project */}
      <section aria-labelledby="next-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeading
            id="next-heading"
            eyebrow="Planning a project"
            title="Start with requirements and evidence"
            description="A real engagement begins by confirming your requirements, available systems, provider constraints, scope, and acceptance criteria. The examples above are not records of prior deliveries."
          />
          <RevealList className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {SERVICES.slice(0, 3).map((service) => (
              <RevealItem key={service.slug} className="h-full">
                <a
                  href={`#/services/${service.slug}`}
                  className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-5 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  <h3 className="text-base font-semibold text-[#0B1F33]">{service.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#526173]">
                    {service.tagline}
                  </p>
                  <CardLinkAffordance className="mt-4">
                    Service detail
                  </CardLinkAffordance>
                </a>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      <CtaBand
        title="Discuss a project requirement"
        description="Tell us about the problem and constraints. We will confirm what can be delivered, which providers need setup, and how success will be measured before making outcome claims."
      />

      {/* Expanded engagement detail */}
      <CaseStudyDialog
        study={activeStudy}
        open={activeStudy !== null}
        onClose={() => setActiveStudy(null)}
      />
    </main>
  );
}
