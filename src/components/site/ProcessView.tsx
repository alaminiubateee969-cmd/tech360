"use client";

import { Clock, Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PROCESS } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { ImageView } from "./ImageView";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

export default function ProcessView() {
  const gates = PROCESS.filter((p) => p.gate);

  return (
    <main id="main-content">
      <PageHero
        eyebrow="Delivery process"
        title="Seven phases. Two gates. Zero surprises."
        description="Discover → Scope → Preview → Payment → Build → Deliver → Handover & Support. Payment begins only after your preview approval; source code is released after final payment. Both rules are published policy."
        breadcrumb={[{ label: "Process" }]}
      />

      {/* Timeline */}
      <section aria-labelledby="timeline-heading" className="bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <h2 id="timeline-heading" className="sr-only">
            The seven-phase delivery timeline
          </h2>
          <ol className="relative space-y-8">
            {PROCESS.map((phase) => (
              <li key={phase.step}>
                <Reveal>
                  <div className="relative grid gap-4 sm:grid-cols-[5rem_1fr] sm:gap-6">
                    {/* Timeline spine + node */}
                    <div className="absolute left-0 top-10 hidden h-full w-px bg-[#E2E8F0] sm:block" aria-hidden="true" />
                    <div className="flex items-center gap-4 sm:flex-col sm:items-start">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#063B8F] text-sm font-bold text-white">
                        {phase.step}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[#526173] sm:mt-1">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {phase.duration}
                      </span>
                    </div>
                    <Card
                      className={`border-[#E2E8F0] ${
                        phase.gate ? "bg-[#F4FAFF] ring-1 ring-[#009FE3]/30" : "bg-white"
                      }`}
                    >
                      <CardContent className="p-6">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-[#0B1F33]">
                            <span className="mr-2 text-[#009FE3]">{phase.name}</span>
                            {phase.title}
                          </h3>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-[#526173] sm:text-base">
                          {phase.description}
                        </p>
                        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                          {phase.details.map((detail) => (
                            <li key={detail} className="flex items-start gap-2 text-sm text-[#0B1F33]">
                              <span
                                aria-hidden="true"
                                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#009FE3]"
                              />
                              {detail}
                            </li>
                          ))}
                        </ul>
                        {phase.gate ? (
                          <div className="mt-5 flex items-start gap-3 rounded-lg border border-[#009FE3]/30 bg-white p-4">
                            <Lock className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-[#009FE3]">
                                {phase.gate.label}
                              </p>
                              <p className="mt-1 text-sm leading-relaxed text-[#526173]">
                                {phase.gate.text}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Lifecycle imagery */}
      <section aria-labelledby="lifecycle-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="lifecycle-heading"
            eyebrow="Under the process"
            title="What the machine looks like"
            description="Every phase above is supported by a working pipeline — from development lifecycle management and the quality checklist that gates delivery to the structured handover that ends every engagement."
          />
          <RevealList className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <RevealItem className="h-full">
              <Card className="h-full overflow-hidden border-[#E2E8F0] bg-white">
                <div className="overflow-hidden">
                  <ImageView
                    src="/images/dev-lifecycle.png"
                    alt="Development lifecycle diagram — from planning through build, review and release"
                    aspect="16/9"
                  />
                </div>
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold text-[#0B1F33]">Development lifecycle</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                    Version-controlled, milestone-tracked work with acceptance
                    criteria defined before code is written — the same discipline
                    your scope enforces.
                  </p>
                </CardContent>
              </Card>
            </RevealItem>
            <RevealItem className="h-full">
              <Card className="h-full overflow-hidden border-[#E2E8F0] bg-white">
                <div className="overflow-hidden">
                  <ImageView
                    src="/images/quality-checklist.png"
                    alt="Quality checklist diagram — functional, performance, security and delivery checks"
                    aspect="16/9"
                  />
                </div>
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold text-[#0B1F33]">Quality checklist</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                    Delivery is a structured event: functional, performance,
                    security and content checks verified together — with you,
                    before sign-off.
                  </p>
                </CardContent>
              </Card>
            </RevealItem>
            <RevealItem className="h-full md:col-span-2 lg:col-span-1">
              <Card className="h-full overflow-hidden border-[#E2E8F0] bg-white">
                <div className="overflow-hidden">
                  <ImageView
                    src="/images/delivery-handover.png"
                    alt="Delivery and handover concept — source code, credentials and documentation transferred to the client"
                    aspect="16/9"
                  />
                </div>
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold text-[#0B1F33]">Delivery &amp; handover</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                    Nothing ends at “done” — code, credentials, documentation
                    and the roadmap for what comes next are transferred to you
                    as a structured, recorded event. You own everything.
                  </p>
                </CardContent>
              </Card>
            </RevealItem>
          </RevealList>
        </div>
      </section>

      {/* Gates summary */}
      <section aria-labelledby="gates-heading" className="bg-gradient-to-br from-[#063B8F] via-[#073a86] to-[#0B1F33]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <Reveal>
            <div className="text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7FD4FF]">
                The two gates
              </p>
              <h2 id="gates-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Where money and code change hands — safely
              </h2>
            </div>
          </Reveal>
          <RevealList className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {gates.map((phase, i) => (
              <RevealItem key={phase.step} className="h-full">
                <Card className="h-full border-white/10 bg-white/5">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-[#009FE3]/15 text-[#7FD4FF]">
                        <ShieldCheck className="size-5" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-bold tracking-widest text-white/40">
                        GATE {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-white">
                      {phase.name} · {phase.gate?.label}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                      {phase.gate?.text}
                    </p>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
            <RevealItem className="h-full">
              <Card className="h-full border-white/10 bg-white/5">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-[#18B83A]/15 text-[#5ED47A]">
                      <Lock className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-bold tracking-widest text-white/40">
                      ALWAYS ON
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">
                    Verification before status change
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    Payments change project status only after verification —
                    never on a screenshot. Every approval, revision and receipt
                    is tied to your Client ID.
                  </p>
                </CardContent>
              </Card>
            </RevealItem>
          </RevealList>
        </div>
      </section>

      <CtaBand
        title="See the process work on your project"
        description="The fastest proof is experience: send one message, and watch a written scope and an HTML preview arrive before any payment request."
      />
    </main>
  );
}
