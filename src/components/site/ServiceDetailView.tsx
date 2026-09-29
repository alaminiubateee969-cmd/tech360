"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SERVICES, getService } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { Icon } from "./icons";
import { AdminDashboardConcept, CrmConsoleConcept } from "./concepts";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { PrimaryLink, AIAssistantLink, CardLinkAffordance } from "./buttons";

/**
 * Optional illustrative interface concepts for specific services. These are
 * hand-coded concept mockups — never claimed client screenshots (client work
 * ships under NDA). Only services listed here render the visual band.
 */
const SERVICE_VISUALS: Record<string, React.ReactNode> = {
  "custom-crm-development": <CrmConsoleConcept />,
  "business-dashboards": <AdminDashboardConcept />,
};

export default function ServiceDetailView({ slug }: { slug: string }) {
  const service = getService(slug);

  if (!service) {
    return (
      <main id="main-content">
        <PageHero
          eyebrow="Service not found"
          title="This service does not exist"
          description="The service you are looking for may have been renamed or the link is outdated. Browse all twenty services instead."
          breadcrumb={[{ label: "Services", href: "#/services" }, { label: "Not found" }]}
        />
        <section className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <Button asChild variant="outline" className="min-h-11 rounded-lg">
              <a href="#/services" className="focus-visible:outline-none">
                <ArrowLeft className="size-4" aria-hidden="true" />
                All services
              </a>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  // Related services: rotate through the catalogue from this service's position
  // so each detail page surfaces different neighbours instead of the same three.
  const currentIndex = SERVICES.findIndex((s) => s.slug === service.slug);
  const related = Array.from({ length: 3 }, (_, offset) => {
    const nextIndex = (currentIndex + 1 + offset) % SERVICES.length;
    return SERVICES[nextIndex];
  }).filter((s) => s && s.slug !== service.slug);

  return (
    <main id="main-content">
      <PageHero
        eyebrow="Service"
        title={service.title}
        description={service.tagline}
        breadcrumb={[{ label: "Services", href: "#/services" }, { label: service.title }]}
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
                    Example engagement
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[#526173]">{service.example}</p>
                </CardContent>
              </Card>
            </Reveal>
          </div>
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
                  href={`#/services/${s.slug}`}
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
        description="WhatsApp reaches a real engineer who can scope your situation in one conversation — and the written scope still follows."
        primaryLabel="Use the project form"
      />
    </main>
  );
}
