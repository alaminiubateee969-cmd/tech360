"use client";

import { ArrowRight, Briefcase, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ROLES, COMPANY } from "@/data/site";
import { imageFor } from "@/data/images";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { ImageView } from "./ImageView";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

function applyHref(roleTitle: string) {
  const subject = encodeURIComponent(`Application — ${roleTitle} — Tech360 Careers`);
  return `mailto:${COMPANY.email}?subject=${subject}`;
}

export default function CareersView() {
  return (
    <main id="main-content">
      <PageHero
        eyebrow="Careers"
        title="Build systems people can trust — and be measured by it"
        description="We hire engineers and operators who want their work inspected, their process written down and their results on the record. Remote-friendly across the USA and Bangladesh."
        breadcrumb={[{ label: "Careers" }]}
      />

      {/* Culture */}
      <section aria-labelledby="culture-heading" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
          <Reveal>
            <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
              <ImageView
                src={imageFor("careers")}
                alt="Tech360 team collaborating — engineering culture photo"
                aspect="4/3"
                eager
              />
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#009FE3]">
              Culture
            </p>
            <h2 id="culture-heading" className="text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">
              Documentation is a first-class skill here
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-[#526173]">
              <p>
                Our clients trust us because our work is inspectable: written
                scopes, logged automations, verified payments, honest failure
                records. That culture starts inside the team — the same
                discipline we sell is the discipline we run on.
              </p>
              <p>
                Engineers own deliverables end-to-end against acceptance
                criteria, not ticket quotas. Automation specialists treat a
                silent failure as a production incident. Designers defend
                decisions with business reasoning. Everyone writes so the next
                person can read.
              </p>
              <p>
                If &ldquo;measured by delivered acceptance criteria&rdquo;
                sounds like the job you actually want — read the openings
                below.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Open roles */}
      <section aria-labelledby="roles-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="roles-heading"
            eyebrow="Open positions"
            title="Current openings"
            description="All applications go directly to the hiring inbox with the role referenced in the subject — no portals, no ghosting. We reply to every serious application."
          />
          <RevealList className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {ROLES.map((role) => (
              <RevealItem key={role.slug} className="h-full">
                <Card className="flex h-full flex-col border-[#E2E8F0] bg-white transition-all duration-300 hover:border-[#009FE3]/40">
                  <CardContent className="flex h-full flex-col p-6 sm:p-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-md bg-[#009FE3]/10 text-xs font-medium text-[#0079AC] hover:bg-[#009FE3]/10">
                        <Briefcase className="mr-1 size-3" aria-hidden="true" />
                        {role.type}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="rounded-md border-[#E2E8F0] text-xs font-medium text-[#526173]"
                      >
                        <MapPin className="mr-1 size-3" aria-hidden="true" />
                        {role.location}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-[#0B1F33]">
                      {role.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                      {role.summary}
                    </p>

                    <div className="mt-6 grid gap-6 sm:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#0B1F33]">
                          Responsibilities
                        </h4>
                        <ul className="mt-3 space-y-2">
                          {role.responsibilities.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-[#526173]">
                              <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-[#009FE3]" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#0B1F33]">
                          Requirements
                        </h4>
                        <ul className="mt-3 space-y-2">
                          {role.requirements.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-[#526173]">
                              <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-[#18B83A]" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-auto pt-6">
                      <a
                        href={applyHref(role.title)}
                        className="group inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#009FE3] px-5 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0090CC] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
                      >
                        Apply by email
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </a>
                      <p className="mt-2 text-xs text-[#526173]">
                        Send your CV and a note on one system you built and are
                        proud of — subject preset.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      <CtaBand
        title="Not the right role — but the right company?"
        description="Tell us what you would build here. Speculative introductions with substance get real replies."
        primaryLabel="Introduce yourself"
      />
    </main>
  );
}
