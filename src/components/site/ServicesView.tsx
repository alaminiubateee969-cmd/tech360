"use client";

import { ArrowRight } from "lucide-react";
import { SERVICES, type Service } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { Icon } from "./icons";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

const GROUPS: { name: string; blurb: string; slugs: string[] }[] = [
  {
    name: "Websites & Platforms",
    blurb: "The public face and the structural backbone — engineered together.",
    slugs: [
      "premium-business-websites",
      "enterprise-websites",
      "ecommerce-platforms",
      "client-portals",
    ],
  },
  {
    name: "CRM, Dashboards & Data",
    blurb: "Systems of record that make every decision answerable.",
    slugs: [
      "custom-crm-development",
      "business-dashboards",
      "database-systems",
      "api-integrations",
    ],
  },
  {
    name: "Automation & AI",
    blurb: "Governed automation: logged, retried, auditable and honest.",
    slugs: [
      "whatsapp-automation",
      "whatsapp-cloud-api-integration",
      "email-automation",
      "sms-automation",
      "n8n-workflow-automation",
      "ai-agent-systems",
      "ai-business-automation",
    ],
  },
  {
    name: "Deployment & Care",
    blurb: "Production-grade infrastructure and living-system maintenance.",
    slugs: [
      "cloud-deployment-google-cloud",
      "cpanel-stackcp-deployment",
      "maintenance-support",
    ],
  },
  {
    name: "Custom Software & Consulting",
    blurb: "When the process is the advantage — or the map must come first.",
    slugs: ["custom-software-development", "digital-transformation-consulting"],
  },
];

function ServiceCard({ service }: { service: Service }) {
  return (
    <a
      href={`#/services/${service.slug}`}
      className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-6 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 hover:shadow-[0_12px_32px_rgba(6,59,143,0.1)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#009FE3] transition-colors group-hover:bg-[#009FE3] group-hover:text-white">
          <Icon name={service.icon} className="size-5" />
        </span>
        <span className="rounded-md border border-[#E2E8F0] bg-[#F4FAFF] px-2 py-1 text-[11px] font-medium text-[#526173]">
          {service.tech.slice(0, 2).join(" · ")}
        </span>
      </div>
      <h3 className="mt-5 text-lg font-semibold text-[#0B1F33]">{service.title}</h3>
      <p className="mt-1 text-sm font-medium text-[#009FE3]">{service.tagline}</p>
      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-[#526173]">
        {service.problem}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {service.features.slice(0, 3).map((f) => (
          <span
            key={f}
            className="line-clamp-1 rounded-md bg-[#F4FAFF] px-2 py-1 text-[11px] font-medium text-[#526173]"
          >
            {f}
          </span>
        ))}
        <span className="rounded-md bg-[#F4FAFF] px-2 py-1 text-[11px] font-semibold text-[#009FE3]">
          +{service.features.length - 3} more
        </span>
      </div>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#009FE3]">
        Service detail
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </a>
  );
}

export default function ServicesView() {
  return (
    <main id="main-content">
      <PageHero
        eyebrow="Services"
        title="Twenty engineering services. One delivery standard."
        description="From your first business website to AI-driven automation — scoped in writing, previewed before payment, delivered with full source handover."
        breadcrumb={[{ label: "Services" }]}
      />

      {GROUPS.map((group) => {
        const services = group.slugs
          .map((slug) => SERVICES.find((s) => s.slug === slug))
          .filter((s): s is Service => Boolean(s));
        return (
          <section
            key={group.name}
            aria-labelledby={`group-${group.name.replace(/[^a-z]/gi, "-").toLowerCase()}`}
            className="border-b border-[#E2E8F0] bg-white last:border-b-0"
          >
            <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
              <SectionHeading
                eyebrow={`${services.length} services`}
                title={group.name}
                description={group.blurb}
                align="left"
                className="max-w-2xl"
              />
              <RevealList className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {services.map((service) => (
                  <RevealItem key={service.slug} className="h-full">
                    <ServiceCard service={service} />
                  </RevealItem>
                ))}
              </RevealList>
            </div>
          </section>
        );
      })}

      {/* How engagement starts */}
      <section className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-[#0B1F33] sm:text-3xl">
              Not sure which service you need?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[#526173]">
              That is what discovery is for. Send one message about your
              business and your goal — the recommended scope comes back in
              writing, and you decide with a preview in hand.
            </p>
            <a
              href="#/contact"
              className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#009FE3] px-6 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0090CC] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
            >
              Get a scoped recommendation
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </Reveal>
        </div>
      </section>

      <CtaBand />
    </main>
  );
}
