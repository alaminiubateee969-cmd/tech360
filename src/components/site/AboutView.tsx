"use client";

import { CheckCircle2, Building2, FileText, Lock, ShieldCheck, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { COMPANY } from "@/data/site";
import { imageFor } from "@/data/images";
import { PageHero } from "./PageHero";
import { SectionHeading } from "./SectionHeading";
import { CtaBand } from "./CtaBand";
import { ImageView } from "./ImageView";
import { Reveal, RevealList, RevealItem } from "./Reveal";

const PRINCIPLES = [
  {
    icon: Eye,
    title: "Preview before payment",
    text: "No client is asked to commit money to something they have not seen working. The HTML preview is a policy gate, not a marketing line.",
    link: "#/legal/delivery",
  },
  {
    icon: FileText,
    title: "Everything in writing",
    text: "Scope, milestones, approvals, payments — recorded against your Client ID. The record answers questions; memory does not.",
    link: "#/legal/client-approval",
  },
  {
    icon: Lock,
    title: "Ownership after final payment",
    text: "Full source code, documentation and credentials are handed over the moment payment is verified. Your system is never hostage.",
    link: "#/legal/source-code-handover",
  },
  {
    icon: ShieldCheck,
    title: "One accountable company",
    text: "A US-registered LLC with on-record operations — every engagement, invoice and handover is traceable to the legal entity.",
    link: "#/legal/terms",
  },
];

export default function AboutView() {
  return (
    <main id="main-content">
      <PageHero
        eyebrow="About Tech360"
        title="An engineering company built around a trust problem"
        description="TECH360 LLC is a US-registered software and automation company operating across the USA–Bangladesh corridor — delivering worldwide."
        breadcrumb={[{ label: "About" }]}
      />

      {/* Story */}
      <section aria-labelledby="story-heading" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <Reveal>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#009FE3]">
                Our story
              </p>
              <h2 id="story-heading" className="text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">
                Founded in 2021 by engineers who kept seeing the same failure
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-[#526173]">
                <p>
                  Tech360 began with a pattern every founding engineer had watched
                  repeat: businesses pay upfront, wait months, and receive
                  something that looks nothing like what was promised. The
                  outsourcing industry had priced, marketed and automated
                  everything except the one thing clients actually needed —
                  proof before payment.
                </p>
                <p>
                  The company was founded in 2021 by engineers working across
                  the USA–Bangladesh corridor, deliberately structured as a
                  Missouri-registered LLC with on-record operations: verifiable
                  registration, EIN, written scopes, receipted payments and
                  full handovers. Not because paperwork is a virtue — because
                  verifiability is what a promise is worth.
                </p>
                <p>
                  Today the same discipline runs through every engagement:
                  you approve a written scope, receive an HTML preview before
                  any payment moves, review each milestone, and take complete
                  ownership of the source code once the final payment is
                  verified. The process is the product.
                </p>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.15} className="min-w-0">
            <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
              <ImageView
                src={imageFor("about")}
                alt="Tech360 engineering team collaborating on client platform work"
                aspect="4/3"
                eager
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Card className="border-[#E2E8F0] bg-[#F8FCFF]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#526173]">Founded</p>
                  <p className="mt-1 text-xl font-bold text-[#0B1F33]">{COMPANY.founded}</p>
                </CardContent>
              </Card>
              <Card className="border-[#E2E8F0] bg-[#F8FCFF]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#526173]">Structure</p>
                  <p className="mt-1 text-xl font-bold text-[#0B1F33]">US LLC · MO</p>
                </CardContent>
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Mission */}
      <section aria-labelledby="mission-heading" className="bg-gradient-to-br from-[#063B8F] via-[#073a86] to-[#0B1F33]">
        <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <Reveal>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7FD4FF]">
              Mission
            </p>
            <h2 id="mission-heading" className="text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl lg:text-4xl">
              Make enterprise-grade software and automation accessible to
              ambitious businesses — without asking them to take it on faith.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-white/70">
              Every practice in this company reduces to one idea: the client
              should hold the proof, the process should hold the risk, and the
              record should hold the truth.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Principles */}
      <section aria-labelledby="principles-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="principles-heading"
            eyebrow="Operating principles"
            title="Four rules the company does not bend"
            description="Each principle is published as policy — the same text governs what clients can hold us to."
          />
          <RevealList className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <RevealItem key={p.title} className="h-full">
                <a
                  href={p.link}
                  className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-6 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 hover:shadow-[0_12px_32px_rgba(6,59,143,0.1)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  <span className="flex size-11 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#009FE3] transition-colors group-hover:bg-[#009FE3] group-hover:text-white">
                    <p.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-[#0B1F33]">{p.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#526173]">{p.text}</p>
                  <span className="mt-4 text-xs font-semibold text-[#009FE3]">Read the policy</span>
                </a>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      {/* Company facts */}
      <section aria-labelledby="facts-heading" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <SectionHeading
              id="facts-heading"
              eyebrow="Company facts"
              title="Verifiable, on the record"
              description="Everything below is public record or confirmable in writing at any point in an engagement."
              align="left"
            />
            <Reveal className="mt-8">
              <dl className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-[#F8FCFF]">
                {[
                  { term: "Legal name", detail: COMPANY.legalName },
                  { term: "Brand", detail: `${COMPANY.brand} · ${COMPANY.domain}` },
                  { term: "Missouri LLC number", detail: COMPANY.missouriLLC },
                  { term: "EIN", detail: COMPANY.ein },
                  { term: "Registered address", detail: COMPANY.address },
                  { term: "Email", detail: COMPANY.email },
                  { term: "WhatsApp", detail: COMPANY.whatsappDisplay },
                  { term: "Founded", detail: COMPANY.founded },
                ].map((row) => (
                  <div
                    key={row.term}
                    className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  >
                    <dt className="text-sm font-medium text-[#526173]">{row.term}</dt>
                    <dd className="text-sm font-semibold text-[#0B1F33] sm:text-right">{row.detail}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          {/* Leadership note */}
          <div>
            <SectionHeading
              eyebrow="Leadership"
              title="An engineering-led company"
              description="Tech360 is run by the people who build. Leadership titles are published without personal branding — the work and the record are the credentials."
              align="left"
            />
            <RevealList className="mt-8 grid gap-5 sm:grid-cols-2">
              {[
                {
                  role: "Founder & CEO, Engineering",
                  scope: "Delivery model, architecture standards, engineering accountability.",
                },
                {
                  role: "Head of Automation & AI",
                  scope: "Automation backbone, agent governance, integration reliability.",
                },
                {
                  role: "Head of Client Delivery",
                  scope: "Scope discipline, milestone acceptance, policy enforcement.",
                },
                {
                  role: "Operations & Compliance",
                  scope: "On-record operations, payments verification, handover discipline.",
                },
              ].map((person) => (
                <RevealItem key={person.role} className="h-full">
                  <Card className="h-full border-[#E2E8F0] bg-white">
                    <CardContent className="p-5">
                      <Building2 className="size-5 text-[#063B8F]" aria-hidden="true" />
                      <h3 className="mt-3 text-sm font-semibold text-[#0B1F33]">{person.role}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#526173]">{person.scope}</p>
                    </CardContent>
                  </Card>
                </RevealItem>
              ))}
            </RevealList>
            <Reveal delay={0.2}>
              <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-[#F8FCFF] p-6">
                <Badge className="mb-3 rounded-md bg-[#18B83A]/10 text-xs font-medium text-[#128025] hover:bg-[#18B83A]/10">
                  A note on names
                </Badge>
                <p className="text-sm leading-relaxed text-[#526173]">
                  We publish roles, not personal brands. You will meet the
                  specific engineers accountable for your engagement — with
                  names, in writing, tied to your Client ID — before any
                  commitment. That is deliberate: reputations should attach to
                  deliverables, not to landing pages.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Delivery model recap */}
      <section aria-labelledby="model-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="model-heading"
            eyebrow="The delivery model"
            title="What working with us looks like"
          />
          <RevealList className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Written scope — every deliverable and milestone defined before work begins",
              "HTML preview — approved by you before any payment moves",
              "Milestone build — acceptance in writing at each stage",
              "Full handover — source code and credentials after final payment",
            ].map((step, i) => (
              <RevealItem key={step}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#18B83A]" aria-hidden="true" />
                  <div>
                    <span className="text-xs font-bold tracking-widest text-[#009FE3]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="mt-1 text-sm leading-relaxed text-[#0B1F33]">{step}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      <CtaBand
        title="Put our process to the test"
        description="Send one message about your project. You will receive a written scope and an HTML preview before any payment decision — the same standard every client gets."
      />
    </main>
  );
}
