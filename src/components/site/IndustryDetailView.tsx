"use client";

import { ArrowRight, ArrowLeft, CircleAlert, CheckCircle2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { INDUSTRIES, getIndustry, getService } from "@/data/site";
import { imageFor } from "@/data/images";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { ImageView } from "./ImageView";
import { Icon } from "./icons";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { PrimaryLink, AIAssistantLink } from "./buttons";

export default function IndustryDetailView({ slug }: { slug: string }) {
  const industry = getIndustry(slug);

  if (!industry) {
    return (
      <main id="main-content">
        <PageHero
          eyebrow="Industry not found"
          title="This industry page does not exist"
          description="The sector you are looking for may have been renamed or the link is outdated. Browse all twenty industries instead."
          breadcrumb={[{ label: "Industries", href: "#/industries" }, { label: "Not found" }]}
        />
        <section className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <Button asChild variant="outline" className="min-h-11 rounded-lg">
              <a href="#/industries" className="focus-visible:outline-none">
                <ArrowLeft className="size-4" aria-hidden="true" />
                All industries
              </a>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  const recommended = industry.recommended
    .map((s) => getService(s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const others = INDUSTRIES.filter((i) => i.slug !== industry.slug).slice(0, 4);

  return (
    <main id="main-content">
      {/* Image hero */}
      <section className="relative overflow-hidden bg-[#0B1F33]">
        <div className="absolute inset-0">
          <ImageView
            src={imageFor(industry.imageKey)}
            alt={`${industry.title} — representative photography`}
            className="h-full w-full"
            imgClassName="opacity-45"
            eager
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0B1F33]/95 via-[#0B1F33]/80 to-[#063B8F]/55"
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 pt-28 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/60">
              <li>
                <a
                  href="#/"
                  className="rounded-sm outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Home
                </a>
              </li>
              <li className="flex items-center gap-1.5">
                <ArrowRight className="size-3.5 opacity-50" aria-hidden="true" />
                <a
                  href="#/industries"
                  className="rounded-sm outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Industries
                </a>
              </li>
              <li className="flex items-center gap-1.5">
                <ArrowRight className="size-3.5 opacity-50" aria-hidden="true" />
                <span aria-current="page" className="text-white/90">
                  {industry.title}
                </span>
              </li>
            </ol>
          </nav>
          <Reveal>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7FD4FF]">
              Industry focus
            </p>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {industry.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              {industry.description}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Problems */}
      <section aria-labelledby="problems-heading" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
          <div>
            <SectionHeading
              id="problems-heading"
              eyebrow="What we see"
              title="Typical problems in this sector"
              align="left"
            />
            <Reveal className="mt-8">
              <ul className="space-y-4">
                {industry.problems.map((problem) => (
                  <li key={problem} className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#FDF7F7] p-4">
                    <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#B4472A]" aria-hidden="true" />
                    <p className="text-sm leading-relaxed text-[#0B1F33]">{problem}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <div>
            <SectionHeading
              eyebrow="What we build"
              title="The Tech360 solution"
              align="left"
            />
            <Reveal delay={0.1} className="mt-8">
              <Card className="border-[#E2E8F0] bg-[#F2FBF4]">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-5 text-[#18B83A]" aria-hidden="true" />
                    <h3 className="text-base font-semibold text-[#0B1F33]">Engineered answer</h3>
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-[#526173]">{industry.solution}</p>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Example system */}
      <section aria-labelledby="example-heading" className="bg-[#F4FAFF]">
        <h2 id="example-heading" className="sr-only">Example system for this sector</h2>
        <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <Reveal>
            <Card className="border-[#009FE3]/30 bg-white">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#009FE3]">
                    <Lightbulb className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">
                      Example system
                    </p>
                    <p className="text-xs text-[#526173]">An illustrative engagement pattern</p>
                  </div>
                </div>
                <p className="mt-5 text-base leading-relaxed text-[#0B1F33]">
                  {industry.exampleSystem}
                </p>
                <p className="mt-4 text-xs leading-relaxed text-[#526173]">
                  Representative project pattern for this sector. Engagements are
                  anonymised; references are available on request under NDA.
                </p>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Recommended services */}
      <section aria-labelledby="recommended-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeading
            id="recommended-heading"
            eyebrow="Recommended"
            title="Services that fit this sector"
            description="Typical starting points — the final scope always comes from your discovery call, not a preset package."
          />
          <RevealList className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recommended.map((service) => (
              <RevealItem key={service.slug} className="h-full">
                <a
                  href={`#/services/${service.slug}`}
                  className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-5 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[#063B8F]/10 text-[#063B8F]">
                    <Icon name={service.icon} className="size-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold leading-snug text-[#0B1F33]">
                    {service.title}
                  </h3>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-[#526173]">
                    {service.tagline}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#009FE3]">
                    View service
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </a>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-[#063B8F] via-[#073a86] to-[#0B1F33]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <Reveal>
            <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7FD4FF]">
                  {industry.title} · next step
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Solving {industry.title.toLowerCase()} problems starts with one message
                </h2>
                <p className="mt-3 text-base leading-relaxed text-white/70">
                  Written scope, HTML preview, milestone plan — the same
                  standards apply in every sector, tuned to your situation.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <PrimaryLink href="#/contact">
                  Start Your Project
                  <ArrowRight className="size-4" aria-hidden="true" />
                </PrimaryLink>
                <AIAssistantLink />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Other industries */}
      <section aria-labelledby="other-industries-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 id="other-industries-heading" className="text-lg font-semibold text-[#0B1F33]">
            Explore other industries
          </h2>
          <RevealList className="mt-6 flex flex-wrap gap-2.5">
            {others.map((other) => (
              <RevealItem key={other.slug}>
                <a
                  href={`#/industries/${other.slug}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#063B8F] outline-none transition-colors hover:border-[#009FE3] hover:text-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  {other.title}
                </a>
              </RevealItem>
            ))}
            <RevealItem>
              <a
                href="#/industries"
                className="inline-flex min-h-11 items-center rounded-lg bg-[#063B8F]/8 px-4 py-2 text-sm font-semibold text-[#063B8F] outline-none transition-colors hover:bg-[#063B8F]/15 focus-visible:ring-2 focus-visible:ring-[#009FE3]"
              >
                All 20 industries
              </a>
            </RevealItem>
          </RevealList>
        </div>
      </section>

      <CtaBand />
    </main>
  );
}
