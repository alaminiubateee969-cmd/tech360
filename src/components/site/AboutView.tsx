"use client";

import { CheckCircle2, Building2, FileText, Lock, ShieldCheck, Eye, Quote } from "lucide-react";
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
    text: "Clients should have a meaningful opportunity to review the proposed solution before making a payment commitment. Our process includes an HTML preview before payment.",
    link: "#/legal/delivery",
    label: "Read our Delivery Policy",
  },
  {
    icon: FileText,
    title: "Everything in writing",
    text: "Project scope, deliverables, milestones, approvals, payment records and important decisions are documented and traceable to the relevant Client ID.",
    link: "#/legal/client-approval",
    label: "Read our Client Approval Policy",
  },
  {
    icon: Lock,
    title: "Clear ownership and handover",
    text: "Following verification of the final payment and completion of the applicable handover requirements, we provide the agreed source code, documentation and credentials.",
    link: "#/legal/source-code-handover",
    label: "Read our Source Code Handover Policy",
  },
  {
    icon: ShieldCheck,
    title: "One accountable company",
    text: "Our client engagements are managed through documented scopes, project records, invoices, approvals and handover procedures. TECH360 LLC is our Missouri-registered US entity.",
    link: "#/legal/terms",
    label: "Read our Terms and Conditions",
  },
];

const WORKING_STEPS = [
  {
    n: "01",
    title: "Understand your requirements",
    text: "We learn about your business, goals, users, constraints and desired outcomes. Important requirements are documented against your Client ID.",
  },
  {
    n: "02",
    title: "Agree on the written scope",
    text: "We define the deliverables, boundaries, milestones, responsibilities and applicable commercial terms for your review.",
  },
  {
    n: "03",
    title: "Review the HTML preview",
    text: "You can evaluate the agreed preview and share feedback before proceeding to payment under our published delivery process.",
  },
  {
    n: "04",
    title: "Build and review milestones",
    text: "We develop the agreed solution in stages, communicate progress, and document milestone reviews and approvals.",
  },
  {
    n: "05",
    title: "Test and refine",
    text: "We carry out the agreed quality checks, address identified issues, and coordinate client review and any revisions included in the project scope.",
  },
  {
    n: "06",
    title: "Complete the handover",
    text: "After the final payment is verified and the agreed release conditions are satisfied, we hand over the contracted source code, documentation and credentials.",
  },
  {
    n: "07",
    title: "Close the engagement",
    text: "We record delivery confirmation and any agreed follow-up actions so the project has a clear, documented conclusion.",
  },
];

export default function AboutView() {
  return (
    <main id="main-content">
      <PageHero
        eyebrow="About TECH360"
        title="Built in Bangladesh. Expanded to the United States. Delivering worldwide."
        description={`TECH360 is a software engineering and business automation company founded in Bangladesh in ${COMPANY.bangladeshFoundedYear}. In ${COMPANY.usRegistrationYear}, the company expanded its international presence through the registration of TECH360 LLC in ${COMPANY.registrationJurisdiction}.`}
        breadcrumb={[{ label: "About" }]}
      />

      {/* Trust principle — the line that frames the whole page */}
      <section aria-label="Our principle" className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-start gap-4 rounded-xl border border-[#E2E8F0] bg-[#F8FCFF] px-5 py-5 sm:px-6">
              <Quote className="mt-0.5 size-5 shrink-0 text-[#009FE3]" aria-hidden="true" />
              <p className="text-sm font-medium leading-relaxed text-[#0B1F33] sm:text-[15px]">
                Our principle is simple: <span className="font-bold">trust should be supported by evidence, not promises alone.</span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Story — two stages, not two founding dates */}
      <section aria-labelledby="story-heading" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <Reveal>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#009FE3]">Our story</p>
              <h2 id="story-heading" className="text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">
                From a Bangladesh-founded engineering team to an international company
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-[#526173]">
                <p>
                  TECH360 began in Bangladesh in 2021 with a practical goal: to help businesses turn ideas into reliable software and automation
                  systems.
                </p>
                <p>
                  As we worked on digital projects, one challenge continued to stand out. Clients needed more than attractive proposals and delivery
                  promises. They needed a clear understanding of what would be built, how progress would be evaluated, what they were paying for, and
                  what they would own at the end.
                </p>
                <p>We built our delivery approach around those needs.</p>
                <p>
                  In 2025, TECH360 expanded its international business presence by registering TECH360 LLC in Missouri, USA. This marked a new stage
                  in the company&apos;s development while building on the engineering experience and operations established in Bangladesh.
                </p>
                <p>
                  Our roots remain in Bangladesh, our registered US entity supports our international business presence, and our services are available
                  to clients worldwide.
                </p>
                <p className="font-medium text-[#0B1F33]">
                  We believe a good client relationship is built through clear commitments, visible progress, documented decisions, and accountable
                  delivery.
                </p>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.15} className="min-w-0">
            <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
              <ImageView
                src={imageFor("about")}
                alt="Illustrative image of professionals collaborating in a modern office — representative, not the actual TECH360 team"
                aspect="4/3"
                eager
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Card className="border-[#E2E8F0] bg-[#F8FCFF]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#526173]">Founded</p>
                  <p className="mt-1 text-lg font-bold text-[#0B1F33]">Bangladesh · {COMPANY.bangladeshFoundedYear}</p>
                </CardContent>
              </Card>
              <Card className="border-[#E2E8F0] bg-[#F8FCFF]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#526173]">US entity</p>
                  <p className="mt-1 text-lg font-bold text-[#0B1F33]">Missouri · {COMPANY.usRegistrationYear}</p>
                  <p className="mt-0.5 text-xs text-[#526173]">{COMPANY.missouriLLC}</p>
                </CardContent>
              </Card>
              <Card className="border-[#E2E8F0] bg-[#F8FCFF]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#526173]">Coverage</p>
                  <p className="mt-1 text-lg font-bold text-[#0B1F33]">{COMPANY.serviceCoverage}</p>
                </CardContent>
              </Card>
            </div>
            <p className="mt-3 text-center text-xs leading-relaxed text-[#8A99AD]">
              Our Bangladesh-founded operations and subsequent US registration represent two stages in the development of TECH360, not two different
              founding dates.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Mission — with three commitments */}
      <section aria-labelledby="mission-heading" className="bg-gradient-to-br from-[#063B8F] via-[#073a86] to-[#0B1F33]">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <Reveal>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7FD4FF]">Our mission</p>
            <h2
              id="mission-heading"
              className="text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl lg:text-4xl"
            >
              Make reliable software and automation accessible to ambitious businesses.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/70">
              We help businesses plan, build, integrate, and improve digital systems without leaving essential decisions hidden behind technical
              complexity.
            </p>
            <p className="mt-3 text-sm font-medium tracking-wide text-white/90">Our work is guided by three commitments:</p>
          </Reveal>
          <RevealList className="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
            {[
              {
                k: "Clarity",
                v: "Define the scope, deliverables, milestones, and responsibilities in writing.",
              },
              {
                k: "Visibility",
                v: "Give clients a meaningful way to review progress and provide feedback.",
              },
              {
                k: "Ownership",
                v: "Make the agreed handover of source code, documentation, and credentials part of the delivery process.",
              },
            ].map((c) => (
              <RevealItem key={c.k}>
                <div className="h-full rounded-xl border border-white/15 bg-white/10 px-5 py-5 backdrop-blur">
                  <p className="text-sm font-bold tracking-wide text-white">{c.k}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/75">{c.v}</p>
                </div>
              </RevealItem>
            ))}
          </RevealList>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-white/60">
              We do not treat communication and accountability as extras. They are part of the engineering work.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Operating principles */}
      <section aria-labelledby="principles-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="principles-heading"
            eyebrow="Operating principles"
            title="Four commitments that guide every engagement"
            description="These principles shape how we manage client projects and communicate our responsibilities."
          />
          <RevealList className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <RevealItem key={p.title} className="h-full">
                <a
                  href={p.link}
                  className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-6 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 hover:shadow-[0_12px_32px_rgba(6,59,143,0.1)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  <span className="flex size-11 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#009FE3] transition-colors group-hover:bg-[#009FE3] group-hover:text-white">
                    <p.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-[#0B1F33]">{p.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#526173]">{p.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#009FE3]">
                    {p.label} <span aria-hidden="true">→</span>
                  </span>
                </a>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      {/* Company information — on the record */}
      <section aria-labelledby="facts-heading" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <SectionHeading
              id="facts-heading"
              eyebrow="Company information"
              title="Our identity, on the record"
              description="Official US registration details are a matter of public record; company history and service coverage are published by TECH360, and engagement-specific terms are confirmed in writing."
              align="left"
            />
            <Reveal className="mt-8">
              <dl className="divide-y divide-[#E2E8F0] overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FCFF]">
                {(
                  [
                    { term: "Brand", detail: COMPANY.brand },
                    { term: "Website", detail: COMPANY.domain, href: `https://${COMPANY.domain}` },
                    { term: "US legal entity", detail: COMPANY.legalName },
                    { term: "US registration jurisdiction", detail: COMPANY.registrationJurisdiction },
                    { term: "Missouri LLC number", detail: COMPANY.missouriLLC },
                    { term: "EIN", detail: COMPANY.ein },
                    { term: "Registered address", detail: COMPANY.address },
                    { term: "Founded in Bangladesh", detail: COMPANY.bangladeshFoundedYear },
                    { term: "US LLC registration", detail: COMPANY.usRegistrationYear },
                    { term: "Service coverage", detail: COMPANY.serviceCoverage },
                    { term: "Email", detail: COMPANY.email, href: `mailto:${COMPANY.email}` },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.term}
                    className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  >
                    <dt className="shrink-0 text-sm font-medium text-[#526173]">{row.term}</dt>
                    <dd className="text-sm font-semibold text-[#0B1F33] sm:text-right">
                      {"href" in row && row.href ? (
                        <a
                          href={row.href}
                          className="rounded-sm underline decoration-[#E2E8F0] underline-offset-4 outline-none hover:decoration-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                        >
                          {row.detail}
                        </a>
                      ) : (
                        row.detail
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-[#8A99AD]">
                Company information and applicable engagement terms identify the relevant legal entity and responsibilities.
              </p>
            </Reveal>
          </div>

          {/* Leadership */}
          <div>
            <SectionHeading
              eyebrow="Leadership and accountability"
              title="Engineering-led. Delivery-focused."
              description="TECH360 is organised around the work required to deliver dependable software and automation. Our responsibilities span engineering, AI and automation, client delivery, and operational oversight."
              align="left"
            />
            <RevealList className="mt-8 grid gap-5 sm:grid-cols-2">
              {[
                {
                  role: "Founder & CEO, Engineering",
                  scope: "Responsible for delivery direction, software architecture, engineering standards, and technical accountability.",
                },
                {
                  role: "Head of Automation & AI",
                  scope: "Responsible for automation architecture, AI system governance, and integration reliability.",
                },
                {
                  role: "Head of Client Delivery",
                  scope: "Responsible for scope coordination, milestone reviews, client communication, and delivery processes.",
                },
                {
                  role: "Operations & Compliance",
                  scope: "Responsible for operational records, payment verification, and handover procedures.",
                },
              ].map((person) => (
                <RevealItem key={person.role} className="h-full">
                  <Card className="h-full border-[#E2E8F0] bg-white">
                    <CardContent className="p-5">
                      <Building2 className="size-5 text-[#063B8F]" aria-hidden="true" />
                      <h3 className="mt-3 text-sm font-semibold leading-snug text-[#0B1F33]">{person.role}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#526173]">{person.scope}</p>
                    </CardContent>
                  </Card>
                </RevealItem>
              ))}
            </RevealList>
            <Reveal delay={0.2}>
              <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-[#F8FCFF] p-6">
                <Badge className="mb-3 rounded-md bg-[#18B83A]/10 text-xs font-medium text-[#128025] hover:bg-[#18B83A]/10">
                  Meet the people responsible for your project
                </Badge>
                <p className="text-sm leading-relaxed text-[#526173]">
                  We prioritise project-specific accountability over personal branding. Before a commitment is made, clients can receive written
                  confirmation of the people responsible for their engagement, their roles, and the relevant communication arrangements.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How working with TECH360 works */}
      <section aria-labelledby="how-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="how-heading"
            eyebrow="How working with TECH360 works"
            title="A defined process from first conversation to final handover"
          />
          <RevealList className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WORKING_STEPS.slice(0, 4).map((s) => (
              <RevealItem key={s.n}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#063B8F] text-xs font-bold text-white">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold leading-snug text-[#0B1F33]">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#526173]">{s.text}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealList>
          <RevealList className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {WORKING_STEPS.slice(4).map((s) => (
              <RevealItem key={s.n}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#063B8F] text-xs font-bold text-white">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold leading-snug text-[#0B1F33]">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#526173]">{s.text}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      {/* What we build */}
      <section aria-labelledby="build-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="build-heading"
            eyebrow="What we build"
            title="From manual processes and fragmented tools towards more connected digital operations"
            description="The right solution depends on your requirements, operating environment, budget, and delivery objectives. We define the proposed work with you before the project proceeds."
          />
          <RevealList className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Custom software and web application development",
              "Business process automation and system integrations",
              "AI-powered assistants and business workflows",
              "CRM and operational management systems",
              "Digital product development and technical consulting",
            ].map((item) => (
              <RevealItem key={item}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FCFF] px-5 py-4">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#18B83A]" aria-hidden="true" />
                  <p className="text-sm font-medium leading-relaxed text-[#0B1F33]">{item}</p>
                </div>
              </RevealItem>
            ))}
          </RevealList>
          <Reveal delay={0.2} className="mt-8 text-center">
            <a
              href="#/services"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-6 text-sm font-semibold text-[#0B1F33] outline-none transition hover:border-[#009FE3]/40 hover:bg-[#F8FCFF] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
            >
              Explore all services
            </a>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Put our process to the test"
        description="Start with a conversation, not a commitment. Tell us what you want to build, improve, or automate. We will work with you to understand the requirements, explain the next steps, and document a proposed scope for your review. You should know what is being proposed, how the work will be reviewed, and what the handover will include before you make a decision."
        primaryLabel="Contact TECH360"
        primaryHref="#/contact"
      />

      {/* Closing identity line — as in the brief */}
      <div className="bg-[#0B1F33] px-4 py-4 text-center sm:px-6">
        <p className="text-xs font-medium tracking-wide text-white/60">
          TECH360 — Founded in Bangladesh in {COMPANY.bangladeshFoundedYear}. Expanded to the United States in {COMPANY.usRegistrationYear}. Delivering {COMPANY.serviceCoverage.toLowerCase()}.
        </p>
      </div>
    </main>
  );
}
