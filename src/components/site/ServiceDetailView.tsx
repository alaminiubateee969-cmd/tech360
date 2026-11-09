"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, CircleAlert, GitCompareArrows, ShieldCheck, Target, Boxes, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SERVICES, getService } from "@/data/site";
import { PageHero } from "./PageHero";
import ServiceJourney from "./ServiceJourney";
import { CtaBand } from "./CtaBand";
import { Icon } from "./icons";
import { AdminDashboardConcept, CrmConsoleConcept } from "./concepts";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { PrimaryLink, AIAssistantLink, CardLinkAffordance } from "./buttons";
import { getIndustryBySlug } from "@/data/industries";
import { SERVICE_IDEAL_CUSTOMER, SERVICE_INDUSTRIES, serviceFaqs } from "@/lib/service-detail-content";
import { PUBLIC_DELIVERY_PROMISES } from "@/lib/public-journey";

/**
 * Optional illustrative interface concepts for specific services. These are
 * hand-coded concept mockups, not customer screenshots or evidence of a
 * completed engagement. Only services listed here render the visual band.
 */
const SERVICE_VISUALS: Record<string, React.ReactNode> = {
  "custom-crm-development": <CrmConsoleConcept />,
  "business-dashboards": <AdminDashboardConcept />,
};

export default function ServiceDetailView({ slug }: { slug: string }) {
  const service = getService(slug);

  if (!service) {
    return (
      <div>
        <PageHero
          eyebrow="Service not found"
          title="This service does not exist"
          description={`The service you are looking for may have been renamed or the link is outdated. Browse all ${SERVICES.length} services instead.`}
          breadcrumb={[{ label: "Services", href: "/services" }, { label: "Not found" }]}
        />
        <section className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <Button asChild variant="outline" className="min-h-11 rounded-lg">
              <a href="/services" className="focus-visible:outline-none">
                <ArrowLeft className="size-4" aria-hidden="true" />
                All services
              </a>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // Related services: rotate through the catalogue from this service's position
  // so each detail page surfaces different neighbours instead of the same three.
  const idealCustomer = SERVICE_IDEAL_CUSTOMER[service.slug];
  const relatedIndustries = (SERVICE_INDUSTRIES[service.slug] ?? [])
    .map((slug) => getIndustryBySlug(slug))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const faqs = serviceFaqs(service);

  const currentIndex = SERVICES.findIndex((s) => s.slug === service.slug);
  const related = Array.from({ length: 3 }, (_, offset) => {
    const nextIndex = (currentIndex + 1 + offset) % SERVICES.length;
    return SERVICES[nextIndex];
  }).filter((s) => s && s.slug !== service.slug);

  return (
    <div>
      <PageHero
        eyebrow="Service"
        title={service.title}
        description={service.tagline}
        breadcrumb={[{ label: "Services", href: "/services" }, { label: service.title }]}
      >
        <div className="flex flex-wrap items-center gap-2">
          {service.tech.map((tech) => (
            <span
              key={tech}
              className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/85"
            >
              {tech}
            </span>
          ))}
        </div>
      </PageHero>

      <ServiceJourney key={service.slug} slug={service.slug} />

      {/* Problem & solution */}
      <section aria-labelledby="problem-solution-heading" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-20">
          <Reveal>
            <Card className="h-full border-[#E2E8F0] bg-[#FDF7F7]">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <CircleAlert className="size-5 text-[#B4472A]" aria-hidden="true" />
                  <h2 id="problem-solution-heading" className="text-lg font-semibold text-[#0B1F33]">
                    The business problem
                  </h2>
                </div>
                <p className="mt-4 text-base leading-relaxed text-[#526173]">{service.problem}</p>
              </CardContent>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="h-full border-[#E2E8F0] bg-[#F2FBF4]">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-[#18B83A]" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-[#0B1F33]">The Tech360 solution</h2>
                </div>
                <p className="mt-4 text-base leading-relaxed text-[#526173]">{service.solution}</p>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="features-heading"
            eyebrow="What is included"
            title="Key features"
            description="Scope is confirmed in writing before work begins — these are the standards this service is built to."
          />
          <RevealList className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {service.features.map((feature, i) => (
              <RevealItem key={feature}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-5">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#18B83A]" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-[#0B1F33]">
                    <span className="mr-2 font-bold text-[#009FE3]">{String(i + 1).padStart(2, "0")}</span>
                    {feature}
                  </p>
                </div>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      {/* Illustrative interface concept (services that have one) */}
      {SERVICE_VISUALS[service.slug] ? (
        <section
          aria-label="Illustrative interface concept"
          className="bg-white"
        >
          <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
            <Reveal>{SERVICE_VISUALS[service.slug]}</Reveal>
          </div>
        </section>
      ) : null}

      {/* Workflow + example */}
      <section aria-labelledby="workflow-heading" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:py-24">
          <div className="lg:col-span-7">
            <SectionHeading
              id="workflow-heading"
              eyebrow="How it runs"
              title="Engagement workflow"
              align="left"
            />
            <Reveal className="mt-8">
              <ol className="relative space-y-6 border-l-2 border-[#E2E8F0] pl-8">
                {service.workflow.map((step, i) => (
                  <li key={step} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[2.55rem] flex size-8 items-center justify-center rounded-full border-2 border-[#009FE3] bg-white text-xs font-bold text-[#009FE3]"
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-[#0B1F33]">{step}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
          <div className="lg:col-span-5">
            <SectionHeading
              eyebrow="Technology"
              title="Built with"
              align="left"
            />
            <Reveal className="mt-8">
              <div className="flex flex-wrap gap-2">
                {service.tech.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-lg border border-[#E2E8F0] bg-[#F4FAFF] px-3.5 py-2 text-sm font-medium text-[#063B8F]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.15} className="mt-8">
              <Card className="border-[#009FE3]/30 bg-[#F4FAFF]">
                <CardContent className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">
                    Illustrative scenario
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[#526173]">{service.example}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
                    Hypothetical example only — not a verified client engagement or measured outcome. Actual scope, integrations, and results require validation.
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Ideal customer profile + fit */}
      {idealCustomer ? (
        <section aria-labelledby="fit-heading" className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <SectionHeading
              id="fit-heading"
              eyebrow="Who this is for"
              title="Ideal customer profile"
              description="Read this before enquiring — it is a faster filter for both sides than a sales call."
              align="left"
            />
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              <Reveal className="lg:col-span-2">
                <div className="h-full rounded-xl border border-[#E2E8F0] bg-[#F4FAFF] p-6 sm:p-7">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[#009FE3]/12 text-[#0079AC]">
                    <Target className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-base leading-relaxed text-[#0B1F33]">{idealCustomer}</p>
                  <p className="mt-4 text-sm leading-relaxed text-[#526173]">
                    Not sure whether you fit? Describe the current process in the project form. If a
                    smaller fix solves it, we will say so — including when you do not need this service.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="h-full rounded-xl border border-[#E2E8F0] bg-white p-6 sm:p-7">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[#063B8F]/10 text-[#063B8F]">
                    <Wrench className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-[#0B1F33]">
                    Architecture &amp; integration fit
                  </h3>
                  <ul className="mt-4 space-y-2">
                    {service.tech.map((t) => (
                      <li key={t} className="flex items-start gap-2 text-sm leading-relaxed text-[#33475B]">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
                        {t}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs leading-relaxed text-[#64748B]">
                    Third-party providers require their own credentials and access approval; integrations are
                    verified in a staging environment before any production cutover.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      ) : null}

      {/* SOW delivery steps — how this specific service is governed */}
      <section aria-labelledby="sow-heading" className="bg-[#0B1F33]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16">
            <div>
              <SectionHeading
                id="sow-heading"
                eyebrow="Commercial model"
                title="What governs this engagement"
                description="The same contract applies to every service. It is written down, dated, and approved before work begins."
                align="left"
                dark
              />
              <ul className="mt-8 space-y-3">
                {PUBLIC_DELIVERY_PROMISES.map((promise) => (
                  <li key={promise} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/80">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#7FD4FF]" aria-hidden="true" />
                    {promise}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <a
                  href="/process"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  See the seven delivery steps
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </div>
            </div>
            <ol className="space-y-3">
              {[
                {
                  t: "Written proposal",
                  d: `Deliverables, USD price, schedule, revision allowance and payment milestones for ${service.title} — with explicit inclusions and exclusions.`,
                },
                {
                  t: "Approved Scope of Work",
                  d: "Work begins only against the approved SOW. A conversation or a proposal draft does not replace that approval.",
                },
                {
                  t: "Review points while it is built",
                  d: "Where the agreed process includes an HTML preview, you review the visual design and the elements actually shown before the applicable payment step.",
                },
                {
                  t: "Verified payment, then handover",
                  d: "Payment counts as received only once cleared funds can be verified. Source code and agreed files follow the SOW's handover terms.",
                },
              ].map((step, i) => (
                <li key={step.t} className="flex gap-4 rounded-xl border border-white/12 bg-white/[0.04] p-5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#009FE3] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{step.t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/70">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Related industries */}
      {relatedIndustries.length > 0 ? (
        <section aria-labelledby="related-industries-heading" className="bg-[#F8FCFF]">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <SectionHeading
              id="related-industries-heading"
              eyebrow="Where this is used"
              title="Industry solutions that build on this service"
              description="Each industry page sets out the workflows, modules, roles and exception paths for that sector."
              align="left"
            />
            <RevealList className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {relatedIndustries.map((entry) => (
                <RevealItem key={entry.slug} className="h-full">
                  <a
                    href={`/industries/${entry.slug}`}
                    className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-5 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 hover:shadow-[0_12px_30px_rgba(6,59,143,0.08)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                  >
                    <Boxes className="size-5 text-[#009FE3]" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-bold text-[#0B1F33]">{entry.name}</h3>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-[#526173]">
                      {entry.category.replace(/-/g, " ")} · {entry.data.workflows.length} workflows ·{" "}
                      {entry.data.modules.length} modules
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#009FE3]">
                      Industry solution
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </a>
                </RevealItem>
              ))}
            </RevealList>
          </div>
        </section>
      ) : null}

      {/* Service FAQs */}
      <section aria-labelledby="service-faq-heading" className="bg-white">
        <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeading
            id="service-faq-heading"
            eyebrow="Before you enquire"
            title={`${service.title} — common questions`}
            description="Scope, schedule, previews and payment. If your question is not here, ask it in the project form and you will get a written answer."
            align="left"
          />
          <div className="mt-8 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] px-5 py-4 open:border-[#009FE3]/40 open:bg-white"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold text-[#0B1F33] outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2">
                  {faq.q}
                  <ChevronDown
                    className="mt-0.5 size-4 shrink-0 text-[#009FE3] transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[#526173]">{faq.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-[#64748B]">
            <GitCompareArrows className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
            Where a question touches contractual terms, the approved Scope of Work and the legal policies
            control — not this page.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-[#063B8F] via-[#073a86] to-[#0B1F33]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <Reveal>
            <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7FD4FF]">
                  Start here
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Scope this service for your business
                </h2>
                <p className="mt-3 text-base leading-relaxed text-white/70">
                  One message begins discovery. You receive a written scope, an
                  HTML preview, and a milestone plan — payment only after your
                  preview approval.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <PrimaryLink href="/contact">
                  Start Your Project
                  <ArrowRight className="size-4" aria-hidden="true" />
                </PrimaryLink>
                <AIAssistantLink />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Related */}
      <section aria-labelledby="related-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeading
            id="related-heading"
            eyebrow="Related services"
            title="Often combined with"
            align="left"
          />
          <RevealList className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {related.map((s) => (
              <RevealItem key={s.slug} className="h-full">
                <a
                  href={`/services/${s.slug}`}
                  className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-5 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[#063B8F]/10 text-[#063B8F]">
                    <Icon name={s.icon} className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-[#0B1F33]">{s.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#526173]">{s.tagline}</p>
                  <CardLinkAffordance className="mt-4">
                    View service
                  </CardLinkAffordance>
                </a>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      <CtaBand
        title="Prefer to talk it through first?"
        description="Use the on-site chat or the project form. A real engineer reads it, and everything that matters is confirmed in the written Scope of Work before work starts."
        primaryLabel="Use the project form"
      />
    </div>
  );
}
