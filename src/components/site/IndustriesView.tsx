"use client";

import { ArrowRight } from "lucide-react";
import { INDUSTRIES } from "@/data/site";
import { imageFor } from "@/data/images";
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
          <RevealList className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((industry) => (
              <RevealItem key={industry.slug}>
                <a
                  href={`#/industries/${industry.slug}`}
                  className="group block h-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(6,59,143,0.12)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  <div className="relative">
                    <ImageView
                      src={imageFor(industry.imageKey)}
                      alt={`${industry.title} — representative photography`}
                      aspect="16/10"
                      imgClassName="transition-transform duration-500 group-hover:scale-105"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#0B1F33]/55 via-transparent to-transparent"
                    />
                    <span className="absolute bottom-3 left-4 text-sm font-semibold text-white">
                      {industry.title}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2 p-4">
                    <p className="line-clamp-2 text-xs leading-relaxed text-[#526173]">
                      {industry.description}
                    </p>
                    <ArrowRight
                      className="mt-0.5 size-4 shrink-0 text-[#009FE3] transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
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
        description="Tell us the sector and the problem you keep hitting. The written scope and HTML preview show exactly how we would solve it — before any payment."
      />
    </main>
  );
}
