"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react";
import { INDUSTRIES, SERVICES } from "@/data/site";
import { industryImage, industryImageAlt } from "@/data/industry-images";
import {
  getServiceImage,
  serviceHeroImageAlt,
  serviceImageAlt,
  serviceImageSrc,
} from "@/data/service-images";
import {
  SERVICE_IDEAL_CUSTOMER,
  SERVICE_INDUSTRIES,
  serviceFaqs,
} from "@/lib/service-detail-content";
import { PUBLIC_DELIVERY_PROMISES, PUBLIC_JOURNEY } from "@/lib/public-journey";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";
import { ImageView } from "./ImageView";
import { ServiceCard } from "./ServiceCard";
import { CtaBand } from "./CtaBand";
import { PrimaryLink, SecondaryLink } from "./buttons";

export default function ServiceDetailView({ slug }: { slug: string }) {
  const service = SERVICES.find((s) => s.slug === slug);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  if (!service) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#009FE3]">
          Service not found
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[#0B1F33]">
          We couldn&rsquo;t find that service
        </h1>
        <p className="mt-3 text-[#526173]">
          The service you&rsquo;re looking for may have moved. Browse all of our
          services below.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <PrimaryLink href="/services">
            <ArrowLeft className="size-4" aria-hidden="true" />
            All Services
          </PrimaryLink>
          <SecondaryLink href="/contact">Talk to Us</SecondaryLink>
        </div>
      </div>
    );
  }

  const idx = SERVICES.findIndex((s) => s.slug === service.slug);
  const related = [
    SERVICES[(idx + 1) % SERVICES.length],
    SERVICES[(idx + 2) % SERVICES.length],
    SERVICES[(idx + 3) % SERVICES.length],
  ];

  const heroImage = getServiceImage(service.slug);
  const idealCustomer = SERVICE_IDEAL_CUSTOMER[service.slug];
  const relatedIndustrySlugs = SERVICE_INDUSTRIES[service.slug] ?? [];
  const relatedIndustries = relatedIndustrySlugs
    .map((industrySlug) => INDUSTRIES.find((i) => i.slug === industrySlug))
    .filter((entry): entry is (typeof INDUSTRIES)[number] => Boolean(entry));
  const faqs = serviceFaqs(service);

  return (
    <div>
      {/* 1. Split Hero with Unique Service-Specific Visual */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#061528] via-[#063B8F] to-[#0B1F33] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[#009FE3]/15 blur-3xl"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/75"
          >
            <a
              href="/services"
              className="inline-flex items-center gap-1.5 hover:text-white focus-visible:outline-none focus-visible:underline"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All Services
            </a>
            <span aria-hidden="true" className="text-white/40">
              /
            </span>
            {heroImage?.category ? (
              <>
                <span className="text-[#7FD4FF]">{heroImage.category}</span>
                <span aria-hidden="true" className="text-white/40">
                  /
                </span>
              </>
            ) : null}
            <span className="text-white">{service.title}</span>
          </nav>

          <div className="mt-8 grid items-center gap-10 lg:grid-cols-12">
            {/* Left: Service Identity, Value Proposition & Primary Actions */}
            <div className="lg:col-span-7">
              <div className="flex items-center gap-3.5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#7FD4FF]">
                  <Icon name={service.icon} className="size-6" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7FD4FF]">
                  {heroImage?.category ? `Service · ${heroImage.category}` : "Service"}
                </p>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {service.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
                {service.tagline}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {service.tech.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <PrimaryLink href="/contact" className="shadow-lg shadow-[#009FE3]/25">
                  Request a Scoped Proposal
                  <ArrowRight className="size-4" aria-hidden="true" />
                </PrimaryLink>
                <a
                  href="/process"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7FD4FF]"
                >
                  How Delivery Works
                </a>
              </div>
            </div>

            {/* Right: Dedicated 1600×1000 Service Architecture Visual */}
            <div className="lg:col-span-5">
              <figure className="overflow-hidden rounded-2xl border border-white/20 bg-[#040E1C]/90 shadow-[0_24px_60px_rgba(4,14,28,0.55)]">
                <ImageView
                  src={heroImage?.src}
                  alt={serviceHeroImageAlt(service.slug, service.title)}
                  aspect="16/10"
                  width={1600}
                  height={1000}
                  eager
                  sizes="(max-width: 1023px) 100vw, 42vw"
                />
                <figcaption className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#061528]/95 px-4 py-2.5 text-[11px] text-white/70">
                  <span className="inline-flex items-center gap-1.5 font-medium text-[#9BEBFF]">
                    <ShieldCheck className="size-3.5 text-[#5AE07A]" aria-hidden="true" />
                    Dedicated architecture visual
                  </span>
                  <span>Scoped in writing · Client-owned</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Problem, Ideal Fit & Deliverables */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="space-y-8 lg:col-span-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">
                The Problem We Solve
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#0B1F33]">
                Why businesses bring us in for {service.title.toLowerCase()}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#526173]">
                {service.problem}
              </p>
            </div>

            {idealCustomer ? (
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F7FAFC] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#063B8F]">
                  Who This Is Built For
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#33475B]">
                  {idealCustomer}
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">
                Our Engineering Approach
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#0B1F33]">
                How Tech360 structures this solution
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#526173]">
                {service.solution}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">
                What&rsquo;s Included
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#0B1F33]">
                Capabilities &amp; deliverables
              </h2>
              <ul className="mt-5 space-y-3">
                {service.features.map((d) => (
                  <li
                    key={d}
                    className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4"
                  >
                    <CheckCircle2
                      className="mt-0.5 size-5 shrink-0 text-[#18B83A]"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-[#0B1F33]">
                      {d}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {service.workflow.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">
                  Execution Sequence
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[#0B1F33]">
                  Typical engagement steps
                </h2>
                <ol className="mt-4 space-y-2.5">
                  {service.workflow.map((step, stepIndex) => (
                    <li
                      key={step}
                      className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-sm text-[#33475B]"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#063B8F] text-xs font-bold text-white">
                        {stepIndex + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>

          {/* Sticky Sidebar: Scope + Public Delivery Guarantees */}
          <aside className="lg:col-span-2">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F7FAFC] p-7">
                <h3 className="text-lg font-bold text-[#0B1F33]">
                  Start a {service.title} project
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                  Share your current workflow and timeline. You&rsquo;ll receive a
                  written Scope of Work with clear milestones and itemized
                  deliverables before any build begins.
                </p>

                <dl className="mt-6 space-y-3 border-t border-[#E2E8F0] pt-5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#526173]">Scope &amp; proposal</dt>
                    <dd className="font-semibold text-[#0B1F33]">
                      Written, itemized SOW
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#526173]">Pre-build review</dt>
                    <dd className="font-semibold text-[#0B1F33]">
                      Interactive HTML Preview
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#526173]">Ownership</dt>
                    <dd className="font-semibold text-[#0B1F33]">
                      100% yours after final payment
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-col gap-2.5">
                  <PrimaryLink href="/contact" className="w-full justify-center">
                    Start Your Project
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </PrimaryLink>
                  <SecondaryLink href="/contact" className="w-full justify-center">
                    Talk to Tech360
                  </SecondaryLink>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#063B8F]">
                  <ShieldCheck className="size-4 text-[#18B83A]" aria-hidden="true" />
                  Delivery Guarantees
                </div>
                <ul className="mt-4 space-y-3">
                  {PUBLIC_DELIVERY_PROMISES.map((promise) => (
                    <li
                      key={promise}
                      className="flex items-start gap-2 text-xs leading-relaxed text-[#526173]"
                    >
                      <CheckCircle2
                        className="mt-0.5 size-3.5 shrink-0 text-[#18B83A]"
                        aria-hidden="true"
                      />
                      <span>{promise}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* 3. Public 7-Step Customer Journey */}
      <section className="border-t border-[#E2E8F0] bg-[#0B1F33] text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7FD4FF]">
              How Delivery Works
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              From first enquiry to source-code handover in seven clear steps
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Every {service.title.toLowerCase()} engagement follows our governed
              client lifecycle so scope, design sign-off, milestones, and
              ownership are explicit from day one.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PUBLIC_JOURNEY.map((item) => (
              <li
                key={item.key}
                className="flex flex-col rounded-2xl border border-white/12 bg-white/5 p-5"
              >
                <span className="text-xs font-bold tracking-[0.2em] text-[#7FD4FF]">
                  STEP 0{item.number}
                </span>
                <h3 className="mt-2 text-base font-bold text-white">
                  {item.title}
                </h3>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-white/75">
                  {item.description}
                </p>
                <p className="mt-3 border-t border-white/10 pt-2.5 text-[11px] font-medium text-[#9BEBFF]">
                  {item.delivers}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Relevant Industries (with sector visuals) */}
      {relatedIndustries.length > 0 ? (
        <section className="border-t border-[#E2E8F0] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">
              Industry Fit
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#0B1F33]">
              Industries that pair with {service.title}
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedIndustries.map((ind) => (
                <a
                  key={ind.slug}
                  href={`/industries/${ind.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#009FE3]/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  <ImageView
                    src={industryImage(ind.slug)}
                    alt={industryImageAlt(ind.title)}
                    aspect="16/10"
                    width={1600}
                    height={900}
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    imgClassName="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="font-bold text-[#0B1F33] group-hover:text-[#063B8F]">
                      {ind.title}
                    </h3>
                    <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[#526173]">
                      {ind.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#0079AC]">
                      Explore {ind.title} solutions
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 5. Service-Specific FAQs */}
      <section className="border-t border-[#E2E8F0] bg-[#F7FAFC]">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">
            Questions &amp; Answers
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#0B1F33]">
            Common questions about {service.title}
          </h2>
          <div className="mt-8 divide-y divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white">
            {faqs.map((faq, faqIdx) => {
              const isOpen = openFaq === faqIdx;
              return (
                <div key={faq.q} className="p-5 sm:p-6">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : faqIdx)}
                    className="flex w-full items-center justify-between gap-4 text-left text-sm font-semibold text-[#0B1F33] sm:text-base"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 text-[#009FE3] transition-transform",
                        isOpen && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen ? (
                    <p className="mt-3 text-sm leading-relaxed text-[#526173]">
                      {faq.a}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Related Services (with each neighbor's unique ServiceCard visual) */}
      <section className="border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009FE3]">
            Explore More
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#0B1F33]">
            Related services
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => {
              const relImg = getServiceImage(r.slug);
              return (
                <ServiceCard
                  key={r.slug}
                  id={r.slug}
                  title={r.title}
                  tagline={r.tagline}
                  description={r.problem}
                  imageSrc={serviceImageSrc(r.slug)}
                  imageAlt={serviceImageAlt(r.slug, r.title)}
                  href={`/services/${r.slug}`}
                  category={relImg?.category}
                  icon={r.icon}
                  badges={r.tech.slice(0, 2)}
                  ctaLabel="Explore service"
                />
              );
            })}
          </div>
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
