"use client";

import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import { KIND_LABEL, featuredPortfolio } from "@/data/portfolio";
import { cn } from "@/lib/utils";
import { MotionPreview } from "./PortfolioMedia";

/**
 * Featured-work spotlight: one large story at a time with its motion preview,
 * metadata, a direct link to the full write-up, and a numbered pager
 * (01 / 05). There is no timed auto-advance — visitors control the pace, and
 * the video only autoplays (muted) without a reduced-motion preference.
 */
export function PortfolioSpotlight() {
  const items = featuredPortfolio();
  const [index, setIndex] = useState(0);
  const entry = items[index];
  if (!entry) return null;

  const go = (next: number) => setIndex((next + items.length) % items.length);

  return (
    <section aria-labelledby="spotlight-heading" aria-roledescription="carousel" className="relative overflow-hidden bg-[#061528]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_70%_at_10%_0%,rgba(0,159,227,0.20),transparent_60%),radial-gradient(80%_60%_at_95%_100%,rgba(24,184,58,0.12),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8FD3F4]">Spotlight</p>
            <h2 id="spotlight-heading" className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Featured work, told problem-first
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold tabular-nums text-white/70" aria-live="polite">
              <span className="text-white">{String(index + 1).padStart(2, "0")}</span> / {String(items.length).padStart(2, "0")}
            </p>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous featured entry"
              className="grid size-11 place-items-center rounded-full border border-white/20 text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#009FE3]"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next featured entry"
              className="grid size-11 place-items-center rounded-full border border-white/20 text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#009FE3]"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          key={entry.slug}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${items.length}: ${entry.title}`}
          className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
        >
          {entry.video ? (
            <MotionPreview video={entry.video} autoPlay showDescription={false} className="shadow-[0_30px_80px_-30px_rgba(0,159,227,0.45)]" />
          ) : (
            <img src={entry.cover.src} alt={entry.cover.alt} className="w-full rounded-2xl" />
          )}

          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#009FE3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#04121F]">
                {KIND_LABEL[entry.kind].singular}
              </span>
              <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#CFE9F7]">
                {entry.industry}
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-bold leading-tight text-white sm:text-3xl">{entry.title}</h3>
            <p className="mt-4 text-base leading-relaxed text-[#A9BED2]">{entry.summary}</p>

            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Capabilities</dt>
                <dd className="mt-1 font-semibold text-white">{entry.capabilities.slice(0, 2).join(" · ")}</dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Indicative build</dt>
                <dd className="mt-1 font-semibold text-white">{entry.deliveryWeeks ?? "Scoped per engagement"}</dd>
              </div>
            </dl>

            <a
              href={entry.href}
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-[#063B8F] outline-none transition hover:bg-[#E6F6FD] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#061528]"
            >
              {KIND_LABEL[entry.kind].cta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Choose featured entry">
          {items.map((item, i) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${item.title}`}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full border px-3 text-left text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#009FE3]",
                i === index ? "border-[#009FE3] bg-[#009FE3]/15 text-white" : "border-white/15 text-white/60 hover:border-white/40 hover:text-white",
              )}
            >
              <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="hidden max-w-[14rem] truncate sm:inline">{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PortfolioSpotlight;
