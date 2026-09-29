"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Star, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SERVICES, INDUSTRIES, CASE_STUDIES, PROCESS, STATS, TRUST_POINTS, COMPANY } from "@/data/site";
import { imageFor } from "@/data/images";
import { Icon } from "./icons";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { StatChip } from "./StatChip";
import { CtaBand } from "./CtaBand";
import { ImageView } from "./ImageView";
import { FeaturesModulesDiagram } from "./diagrams";
import { PrimaryLink, OutlineLink, AIAssistantLink, LinkArrow } from "./buttons";

/* ------------------------------------------------------------------ */
/* Cinematic hero                                                      */
/* ------------------------------------------------------------------ */

const HERO_WORDS = ["Strategy.", "Software.", "Automation.", "Growth."];

function Hero({ onNavigate }: { onNavigate?: (hash: string) => void }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  // Render the video only once the hero is in view (or shortly after mount)
  // so the clip never blocks first paint.
  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (!cancelled) setVideoReady(true);
    };
    const el = sectionRef.current;
    if (el && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            start();
            io.disconnect();
          }
        },
        { rootMargin: "200px" }
      );
      io.observe(el);
      // Fallback in case the observer never fires (background tabs).
      const t = window.setTimeout(start, 2000);
      return () => {
        cancelled = true;
        io.disconnect();
        window.clearTimeout(t);
      };
    }
    start();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v || videoFailed) return;
    // Honest toggle: we only un mute the clip. If the file carries no audio
    // track it stays silent — the label reflects the video's real state.
    v.muted = !v.muted;
    setSoundOn(!v.muted);
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-heading"
      className="relative flex min-h-[92svh] items-center overflow-hidden bg-[#0B1F33]"
    >
      {/* Poster first (CSS background) — always present, also the fallback */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/videos/hero-poster.jpg)" }}
      />
      {/* Video layered above the poster, below the readability gradient */}
      {videoReady && !videoFailed ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/videos/hero-poster.jpg"
          onError={() => setVideoFailed(true)}
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/videos/hero-loop.mp4" type="video/mp4" />
        </video>
      ) : null}
      {/* Readability gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[#0B1F33]/96 via-[#0B1F33]/78 to-[#063B8F]/45"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0B1F33]/80 to-transparent"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-7"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur">
            <span className="size-1.5 rounded-full bg-[#18B83A]" aria-hidden="true" />
            {COMPANY.legalName} · Missouri, USA
          </span>
        </motion.div>

        <h1 id="hero-heading" className="max-w-3xl">
          {HERO_WORDS.map((word, i) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.15 + i * 0.14, ease: [0.21, 0.47, 0.32, 0.98] }}
              className={cn(
                "block text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl",
                i === HERO_WORDS.length - 1 ? "text-[#009FE3]" : "text-white"
              )}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg"
        >
          {COMPANY.subline}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.05 }}
          className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4"
        >
          <PrimaryLink
            href="#/contact"
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate("#/contact");
              }
            }}
          >
            Start Your Project
            <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" aria-hidden="true" />
          </PrimaryLink>
          <OutlineLink href="#/work" dark>
            Explore Our Work
          </OutlineLink>
          <AIAssistantLink label="Talk to Tech360" />
        </motion.div>

        {/* Trust strip */}
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="mt-12 flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2"
        >
          {TRUST_POINTS.map((point) => (
            <li key={point} className="flex items-center gap-2 text-sm text-white/75">
              <CheckCircle2 className="size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
              {point}
            </li>
          ))}
        </motion.ul>
      </div>

      {/* Honest video-sound state pill */}
      <div className="absolute bottom-5 right-4 sm:right-6">
        <button
          type="button"
          onClick={toggleSound}
          disabled={!videoReady || videoFailed}
          aria-pressed={soundOn}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-xs font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          {soundOn ? (
            <Volume2 className="size-4" aria-hidden="true" />
          ) : (
            <VolumeX className="size-4" aria-hidden="true" />
          )}
          Sound: {soundOn ? "On" : "Off"}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Industries served strip                                             */
/* ------------------------------------------------------------------ */

function IndustriesServedStrip() {
  const items = ["eCommerce", "Healthcare", "Education", "Real Estate", "Logistics", "Finance"];
  return (
    <section aria-label="Industries served" className="border-b border-[#E2E8F0] bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-[#526173]">
            Industries we deliver for
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-start">
            {items.map((item, i) => (
              <li key={item} className="flex items-center gap-3">
                {i > 0 ? (
                  <span aria-hidden="true" className="hidden size-1 rounded-full bg-[#E2E8F0] sm:block" />
                ) : null}
                <span className="text-sm font-semibold text-[#0B1F33]/75">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Flagship services                                                   */
/* ------------------------------------------------------------------ */

const FLAGSHIP_SLUGS = [
  "premium-business-websites",
  "ecommerce-platforms",
  "custom-crm-development",
  "whatsapp-automation",
  "n8n-workflow-automation",
  "ai-agent-systems",
];

function FlagshipServices() {
  const flagship = FLAGSHIP_SLUGS.map((slug) => SERVICES.find((s) => s.slug === slug)!).filter(Boolean);
  return (
    <section aria-labelledby="services-heading" className="bg-[#F4FAFF]">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="services-heading"
          eyebrow="What we do"
          title="Six ways we move a business forward"
          description="Twenty engineering services, one operating principle: show you the result before you pay for it."
        />
        <RevealList className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {flagship.map((service) => (
            <RevealItem key={service.slug}>
              <a
                href={`#/services/${service.slug}`}
                className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-6 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/50 hover:shadow-[0_12px_32px_rgba(6,59,143,0.1)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
              >
                <span className="flex size-11 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#009FE3] transition-colors group-hover:bg-[#009FE3] group-hover:text-white">
                  <Icon name={service.icon} className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-[#0B1F33]">{service.title}</h3>
                <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-[#526173]">
                  {service.tagline} {service.solution.split(".")[0]}.
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#009FE3]">
                  View service
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </a>
            </RevealItem>
          ))}
        </RevealList>
        <div className="mt-10 text-center">
          <OutlineLink href="#/services">All 20 services</OutlineLink>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Why Tech360                                                         */
/* ------------------------------------------------------------------ */

const DIFFERENTIATORS = [
  {
    icon: "Eye",
    title: "HTML preview before payment",
    text: "A working, clickable preview of your solution — generated from your approved scope and delivered before any payment request. Evaluate quality with your own eyes first.",
    link: { label: "Delivery Policy", href: "#/legal/delivery" },
  },
  {
    icon: "FileCheck",
    title: "Source code after full payment",
    text: "The complete source package, documentation and every credential are handed over once final payment is verified. You own the system outright — no hostage hosting.",
    link: { label: "Handover Policy", href: "#/legal/source-code-handover" },
  },
  {
    icon: "ShieldCheck",
    title: "US LLC, on-record operations",
    text: "TECH360 LLC is a Missouri-registered company (LC014737249) with EIN registration. Every engagement, payment and approval is on the record and tied to your Client ID.",
    link: { label: "About the company", href: "#/about" },
  },
  {
    icon: "Layers",
    title: "Full-stack delivery, web to AI",
    text: "One accountable team from your public website to your CRM, automation and AI systems — designed, built, deployed and handed over as one coherent platform.",
    link: { label: "Explore services", href: "#/services" },
  },
];

function WhyTech360() {
  return (
    <section aria-labelledby="why-heading" className="bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading
              id="why-heading"
              eyebrow="Why Tech360"
              title="Trust designed into the process, not promised in a pitch"
              description="Outsourcing fails when risk sits entirely on one side. Our delivery model puts proof before payment and ownership after it — written into policy, not chat messages."
              align="left"
            />
            <div className="mt-8 hidden overflow-hidden rounded-xl border border-[#E2E8F0] lg:block">
              <FeaturesModulesDiagram />
            </div>
          </div>
          <RevealList className="grid gap-6 sm:grid-cols-2 lg:col-span-7">
            {DIFFERENTIATORS.map((d) => (
              <RevealItem key={d.title} className="h-full">
                <Card className="h-full border-[#E2E8F0] bg-[#F8FCFF] transition-colors hover:border-[#009FE3]/40">
                  <CardContent className="flex h-full flex-col p-6">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-[#063B8F] text-white">
                      <Icon name={d.icon} className="size-5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-[#0B1F33]">{d.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#526173]">{d.text}</p>
                    <LinkArrow href={d.link.href} className="mt-4 self-start text-[#009FE3]">
                      {d.link.label}
                    </LinkArrow>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Industries preview                                                  */
/* ------------------------------------------------------------------ */

const HOME_INDUSTRY_SLUGS = [
  "ecommerce",
  "healthcare",
  "education",
  "real-estate",
  "logistics",
  "finance",
  "restaurants-food",
  "international-smes",
];

function IndustriesPreview() {
  const tiles = HOME_INDUSTRY_SLUGS.map((slug) => INDUSTRIES.find((i) => i.slug === slug)!).filter(Boolean);
  return (
    <section aria-labelledby="industries-heading" className="bg-[#F4FAFF]">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="industries-heading"
          eyebrow="Industries"
          title="Built for the way your industry actually works"
          description="We start from the problems your sector knows by name — then engineer the system that removes them."
        />
        <RevealList className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((industry) => (
            <RevealItem key={industry.slug}>
              <a
                href={`#/industries/${industry.slug}`}
                className="group block overflow-hidden rounded-xl border border-[#E2E8F0] bg-white outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(6,59,143,0.12)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
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
                <p className="line-clamp-2 px-4 py-3.5 text-xs leading-relaxed text-[#526173]">
                  {industry.description}
                </p>
              </a>
            </RevealItem>
          ))}
        </RevealList>
        <div className="mt-10 text-center">
          <OutlineLink href="#/industries">All 20 industries</OutlineLink>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Process strip (5 steps)                                             */
/* ------------------------------------------------------------------ */

function ProcessStrip() {
  const steps = PROCESS.slice(0, 5);
  return (
    <section aria-labelledby="process-heading" className="bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="process-heading"
          eyebrow="How delivery works"
          title="Seven phases. Two gates. Zero surprises."
          description="Payment begins only after your preview approval — and the source code is released after final payment. Everything between is written, milestone-tracked and on the record."
        />
        <Reveal className="mt-12">
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {steps.map((phase, i) => (
              <li
                key={phase.step}
                className="relative rounded-xl border border-[#E2E8F0] bg-[#F8FCFF] p-5"
              >
                <span className="text-xs font-bold tracking-widest text-[#009FE3]">{phase.step}</span>
                <h3 className="mt-2 text-base font-semibold text-[#0B1F33]">{phase.name}</h3>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[#526173]">
                  {phase.description}
                </p>
                {i < steps.length - 1 ? (
                  <ArrowRight
                    aria-hidden="true"
                    className="absolute top-1/2 -right-3 z-10 hidden size-5 -translate-y-1/2 rounded-full border border-[#E2E8F0] bg-white p-0.5 text-[#009FE3] lg:block"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </Reveal>
        <div className="mt-10 text-center">
          <LinkArrow href="#/process" className="text-sm">
            See the full 7-phase process with approval gates
          </LinkArrow>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Selected work                                                       */
/* ------------------------------------------------------------------ */

function SelectedWork() {
  const cases = CASE_STUDIES.slice(0, 3);
  return (
    <section aria-labelledby="work-heading" className="bg-[#F4FAFF]">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="work-heading"
          eyebrow="Selected work"
          title="Representative engagements"
          description="Anonymised project patterns from real deliveries. Client references are available on request under NDA."
        />
        <RevealList className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {cases.map((c) => (
            <RevealItem key={c.slug} className="h-full">
              <Card className="flex h-full flex-col border-[#E2E8F0] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/40 hover:shadow-[0_12px_32px_rgba(6,59,143,0.1)]">
                <CardContent className="flex h-full flex-col p-6">
                  <Badge className="mb-4 w-fit rounded-md bg-[#063B8F]/10 text-xs font-medium text-[#063B8F] hover:bg-[#063B8F]/10">
                    {c.industry}
                  </Badge>
                  <h3 className="text-lg font-semibold leading-snug text-[#0B1F33]">{c.title}</h3>
                  <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-[#526173]">
                    {c.challenge}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {c.stack.slice(0, 4).map((tech) => (
                      <span
                        key={tech}
                        className="rounded-md border border-[#E2E8F0] bg-[#F4FAFF] px-2 py-1 text-[11px] font-medium text-[#526173]"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </RevealItem>
          ))}
        </RevealList>
        <div className="mt-10 text-center">
          <OutlineLink href="#/work">All representative engagements</OutlineLink>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Client reviews (real only — hidden until a client review is         */
/* submitted, moderated and consented; never fabricated)              */
/* ------------------------------------------------------------------ */

interface PublicReviewItem {
  id: string;
  name: string;
  businessName?: string | null;
  country?: string | null;
  projectName?: string | null;
  rating: number;
  content: string;
  date: string;
}

function ClientReviews() {
  const [reviews, setReviews] = useState<PublicReviewItem[] | null>(null);

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    fetch("/api/reviews", { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((json: { reviews?: PublicReviewItem[] }) => {
        if (active) setReviews(Array.isArray(json.reviews) ? json.reviews : []);
      })
      .catch(() => {
        if (active) setReviews([]);
      });
    return () => {
      active = false;
      ctrl.abort();
    };
  }, []);

  if (!reviews || reviews.length === 0) return null; // honest: no fabricated testimonials

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");

  return (
    <section aria-labelledby="reviews-heading" className="bg-[#F4FAFF]">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="reviews-heading"
          eyebrow="Client reviews"
          title="What clients say after delivery"
          description="Every review below was submitted by a real client after project delivery, with their explicit consent to publish — nothing here is written by us."
        />
        <RevealList
          className={
            reviews.length === 1
              ? "mt-12 mx-auto grid max-w-xl grid-cols-1 gap-6"
              : reviews.length === 2
                ? "mt-12 mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2"
                : "mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          }
        >
          {reviews.slice(0, 6).map((r) => (
            <RevealItem key={r.id} className="h-full">
              <Card className="relative flex h-full flex-col border-[#E2E8F0] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#18B83A]/40 hover:shadow-[0_12px_32px_rgba(24,184,58,0.08)]">
                <CardContent className="flex h-full flex-col p-6">
                  <div className="flex items-center gap-1" aria-label={`${r.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-300"}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-[#526173]">“{r.content}”</p>
                  <div className="mt-5 flex items-center gap-3 border-t border-[#E2E8F0] pt-4">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#009FE3] to-[#063B8F] text-sm font-bold text-white"
                      aria-hidden="true"
                    >
                      {initials(r.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0B1F33]">{r.name}</p>
                      <p className="truncate text-xs text-[#526173]">
                        {r.businessName ?? r.projectName ?? "Tech360 client"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </RevealItem>
          ))}
        </RevealList>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stats band                                                          */
/* ------------------------------------------------------------------ */

function StatsBand() {
  return (
    <section aria-labelledby="stats-heading" className="bg-gradient-to-br from-[#063B8F] via-[#073a86] to-[#0B1F33]">
      <h2 id="stats-heading" className="sr-only">Company facts we can verify</h2>
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatChip key={stat.label} {...stat} dark />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Latest insights (blog)                                              */
/* ------------------------------------------------------------------ */

interface BlogListPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  coverImage?: string;
}

function LatestInsights() {
  // Derived-loading pattern: the cache records which request it belongs to,
  // so "loading" is computed by comparing keys — no setState in the effect body.
  const [tick, setTick] = useState(0);
  const [cache, setCache] = useState<{
    key: number;
    posts: BlogListPost[] | null;
    error: string | null;
  }>({ key: -1, posts: null, error: null });

  const requestKey = tick;
  const fresh = cache.key === requestKey;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/blog")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as { posts?: BlogListPost[] };
        if (!cancelled)
          setCache({
            key: requestKey,
            posts: Array.isArray(data.posts) ? data.posts : [],
            error: null,
          });
      })
      .catch(() => {
        if (!cancelled)
          setCache({
            key: requestKey,
            posts: null,
            error: "Insights could not be loaded right now.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const posts = fresh ? cache.posts : null;
  const error = fresh ? cache.error : null;
  const reload = () => setTick((t) => t + 1);

  const formatDate = (value: string) => {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return value;
    }
  };

  return (
    <section aria-labelledby="insights-heading" className="bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="insights-heading"
          eyebrow="Latest insights"
          title="How we think about engineering and trust"
          description="Notes from our team on delivery discipline, automation and the technology decisions behind client work."
        />

        {posts === null && !error ? (
          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="border-[#E2E8F0] bg-white">
                <CardContent className="space-y-4 p-6">
                  <Skeleton className="h-5 w-24 rounded-md" />
                  <Skeleton className="h-6 w-full rounded-md" />
                  <Skeleton className="h-6 w-4/5 rounded-md" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {error ? (
          <Card className="mx-auto mt-12 max-w-2xl border-[#E2E8F0] bg-[#F8FCFF]">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <p className="text-sm text-[#526173]">{error}</p>
              <Button
                variant="outline"
                className="min-h-11 rounded-lg"
                onClick={reload}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {posts && posts.length === 0 && !error ? (
          <p className="mt-12 text-center text-sm text-[#526173]">
            No articles published yet. New engineering notes are on the way.
          </p>
        ) : null}

        {posts && posts.length > 0 ? (
          <RevealList className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {posts.slice(0, 3).map((post) => (
              <RevealItem key={post.slug} className="h-full">
                  <a
                    href={`#/blog/${post.slug}`}
                    className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-6 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/40 hover:shadow-[0_12px_32px_rgba(6,59,143,0.1)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className="rounded-md bg-[#009FE3]/10 text-xs font-medium text-[#0079AC] hover:bg-[#009FE3]/10">
                        {post.category}
                      </Badge>
                      <time className="text-xs text-[#526173]">{formatDate(post.publishedAt)}</time>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold leading-snug text-[#0B1F33] group-hover:text-[#063B8F]">
                      {post.title}
                    </h3>
                    <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-[#526173]">
                      {post.excerpt}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#009FE3]">
                      Read article
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </a>
                </RevealItem>
            ))}
          </RevealList>
        ) : null}

        {posts && posts.length > 0 ? (
          <div className="mt-10 text-center">
            <OutlineLink href="#/blog">All articles</OutlineLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Home view                                                           */
/* ------------------------------------------------------------------ */

export default function HomeView({
  onNavigate,
}: {
  onNavigate?: (hash: string) => void;
}) {
  return (
    <main id="main-content">
      <Hero onNavigate={onNavigate} />
      <IndustriesServedStrip />
      <FlagshipServices />
      <WhyTech360 />
      <IndustriesPreview />
      <ProcessStrip />
      <SelectedWork />
      <ClientReviews />
      <StatsBand />
      <LatestInsights />
      <CtaBand />
    </main>
  );
}
