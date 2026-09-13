"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CheckCircle2, Compass, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CASE_STUDIES, SERVICES } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { CardLinkAffordance } from "./buttons";

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

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    fetch("/api/reviews", { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((json: { reviews?: PublicReviewItem[] }) => {
        if (active) setReviews(Array.isArray(json.reviews) ? json.reviews : []);
      })
      .catch(() => {
        if (active) setReviews([]);
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
          eyebrow="Client reviews"
          title="Verified client feedback"
          description="Reviews are submitted by clients in their portal after delivery and published only with explicit consent — we never write them ourselves."
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
        ) : reviews.length === 0 ? (
          <Reveal>
            <div className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5">
              <Star className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[#526173]">
                <span className="font-semibold text-[#0B1F33]">No published reviews yet.</span>{" "}
                Reviews appear here only after a client submits one in their portal and consents
                to public display — we do not fabricate testimonials. NDA client references are
                available on request in the meantime.
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
  return (
    <main id="main-content">
      <PageHero
        eyebrow="Our work"
        title="Representative engagements"
        description="Anonymised delivery patterns from real client work across eight sectors. We do not publish client names or fabricated metrics — client references are available on request under NDA."
        breadcrumb={[{ label: "Work" }]}
      />

      <section aria-labelledby="cases-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <Reveal>
            <div className="mb-10 flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5">
              <Compass className="mt-0.5 size-5 shrink-0 text-[#009FE3]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[#526173]">
                <span className="font-semibold text-[#0B1F33]">How to read these:</span>{" "}
                representative project patterns; references available on
                request under NDA. Outcomes are described qualitatively — we
                report what changed, not invented numbers.
              </p>
            </div>
          </Reveal>

          <h2 id="cases-heading" className="sr-only">Case study list</h2>
          <RevealList className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {CASE_STUDIES.map((study) => (
              <RevealItem key={study.slug} className="h-full">
                <Card className="flex h-full flex-col border-[#E2E8F0] bg-white transition-all duration-300 hover:border-[#009FE3]/40 hover:shadow-[0_12px_32px_rgba(6,59,143,0.08)]">
                  <CardContent className="flex h-full flex-col p-6 sm:p-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="rounded-md bg-[#063B8F]/10 text-xs font-medium text-[#063B8F] hover:bg-[#063B8F]/10">
                        {study.industry}
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
                            Outcome
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-[#526173]">
                            {study.outcome}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-1.5 border-t border-[#E2E8F0] pt-5">
                      {study.stack.map((tech) => (
                        <span
                          key={tech}
                          className="rounded-md border border-[#E2E8F0] bg-[#F4FAFF] px-2 py-1 text-[11px] font-medium text-[#526173]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </CardContent>
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
            eyebrow="From pattern to project"
            title="Your engagement follows the same discipline"
            description="Every representative pattern above was delivered through the same governed process — written scope, preview approval, verified milestones, full handover."
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
        title="Ask for references — then start your own"
        description="Under NDA we connect you with clients whose situation matches yours. And when you are ready, your project starts with the same preview-before-payment standard."
      />
    </main>
  );
}
