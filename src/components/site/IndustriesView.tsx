"use client";

import { ArrowRight } from "lucide-react";
import { INDUSTRIES, getService } from "@/data/site";
import { imageFor } from "@/data/images";
import { industryImage } from "@/data/industry-images";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { ImageView } from "./ImageView";
import { RevealList, RevealItem } from "./Reveal";

export default function IndustriesView() {
  return (
    <main id="main-content">
      <PageHero
        eyebrow="Industries"
        title="Twenty industries. Sector-specific patterns, not templates."
        description="We start from the problems your industry knows by name — then engineer the system that removes them. Select your sector to see the typical problems, our solution and an example system."
        breadcrumb={[{ label: "Industries" }]}
      />

      <section aria-labelledby="industry-grid-heading" className="bg-[#F4FAFF]">
        <h2 id="industry-grid-heading" className="sr-only">
         All industries
        </h2>
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#007da8]">Find your sector</p>
              <h2 className="mt-3 text-2xl font-bold text-[#0B1F33] sm:text-3xl">Explore our industry focus</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#526173]">
                Discover relevant services and illustrative workflows. Exact features and delivery are subject to an agreed written scope.
              </p>
            </div>
            <p className="text-xs text-[#526173]">Imagery is AI-generated and illustrative.</p>
          </div>
          <RevealList className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((industry) => (
              <RevealItem key={industry.slug}>
                <a
                  href={`#/industries/${industry.slug}`}
                  className="group block h-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(6,59,143,0.12)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  <div className="relative">
                    <ImageView
                      src={industryImage(industry.slug) ?? imageFor(industry.imageKey)}
                      alt={`${industry.title} — illustrative imagery`}
                      aspect="16/10"
                      imgClassName="transition-transform duration-500 group-hover:scale-105"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#0B1F33]/55 via-transparent to-transparent"
                    />
                    <span className="absolute left-4 top-4 rounded-full border border-white/30 bg-[#0B1F33]/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                      Industry focus
                    </span>
                  </div>
                  <div className="flex min-h-48 flex-col p-5">
                    <h3 className="text-lg font-bold text-[#0B1F33]">{industry.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#526173]">
                      {industry.description}
                    </p>
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
            ))}
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
        description="Tell us your sector and requirements. We can prepare a written proposal and scope; an HTML Preview is included where agreed before the applicable payment."
      />
    </main>
  );
}
