"use client";

import { useRef } from "react";
import { ArrowUpRight, PlayCircle } from "lucide-react";

import { KIND_LABEL, type PortfolioEntry } from "@/data/portfolio";
import { cn } from "@/lib/utils";
import { ProvenanceBadge, formatDuration, usePrefersReducedMotion } from "./PortfolioMedia";

/**
 * Portfolio card. The whole card is one real link to the dedicated detail page
 * (crawlable, middle-click friendly). On devices with a fine pointer and no
 * reduced-motion preference, hovering or focusing the card plays the silent
 * concept preview in place of the cover — the "living card" pattern used by
 * international portfolio pages.
 */
export function PortfolioCard({
  entry,
  priority = false,
  layout = "grid",
  headingLevel = "h3",
}: {
  entry: PortfolioEntry;
  priority?: boolean;
  layout?: "grid" | "list";
  headingLevel?: "h2" | "h3";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const Heading = headingLevel;
  const hoverVideo = Boolean(entry.video) && !reduced;

  const start = () => {
    if (!hoverVideo || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => null);
  };
  const stop = () => {
    const el = videoRef.current;
    if (el && !el.paused) el.pause();
  };

  const list = layout === "list";

  return (
    <article
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/60 hover:shadow-[0_20px_50px_-20px_rgba(6,59,143,0.35)] focus-within:border-[#009FE3] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        list ? "flex flex-col sm:flex-row" : "flex flex-col",
      )}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-[#061528]",
          list ? "aspect-[16/10] sm:aspect-auto sm:w-[42%]" : "aspect-[16/10] w-full",
        )}
      >
        <img
          src={entry.cover.srcSmall ?? entry.cover.src}
          srcSet={entry.cover.srcSmall ? `${entry.cover.srcSmall} 800w, ${entry.cover.src} ${entry.cover.width}w` : undefined}
          sizes={list ? "(max-width: 639px) 100vw, 40vw" : "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"}
          alt={entry.cover.alt}
          width={entry.cover.width}
          height={entry.cover.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
        />
        {hoverVideo && entry.video ? (
          <video
            ref={videoRef}
            src={entry.video.src}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        ) : null}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#040E1C]/70 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[#063B8F] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
            {KIND_LABEL[entry.kind].singular}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <ProvenanceBadge provenance={entry.cover.provenance} />
          {entry.video ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#0B1F33]">
              <PlayCircle className="size-3.5 text-[#009FE3]" aria-hidden="true" />
              <span className="sr-only">Includes a concept motion preview,</span>
              {formatDuration(entry.video.durationSeconds)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0079AC]">{entry.industry}</p>
        <Heading className="mt-2 text-lg font-bold leading-snug text-[#0B1F33] group-hover:text-[#063B8F]">
          <a
            href={entry.href}
            className="outline-none after:absolute after:inset-0 after:z-[1] after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-[#009FE3] focus-visible:after:ring-offset-2"
          >
            {entry.title}
          </a>
        </Heading>
        <p className="mt-2.5 line-clamp-3 flex-1 text-sm leading-relaxed text-[#526173]">{entry.summary}</p>

        {entry.stages.length ? (
          <ol className="mt-4 flex flex-wrap items-center gap-1 text-[11px] font-medium text-[#334155]" aria-label="Workflow stages">
            {entry.stages.slice(0, 4).map((stage, index) => (
              <li key={stage} className="flex items-center gap-1">
                {index > 0 ? <span aria-hidden="true" className="text-[#9FB3C8]">→</span> : null}
                <span className="rounded-md bg-[#F1F6FB] px-2 py-0.5">{stage}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Capabilities">
          {entry.capabilities.map((capability) => (
            <li key={capability} className="rounded-full border border-[#E2E8F0] px-2.5 py-0.5 text-[11px] font-medium text-[#526173]">
              {capability}
            </li>
          ))}
        </ul>

        <span className="mt-5 inline-flex items-center gap-1.5 border-t border-[#F1F5F9] pt-4 text-xs font-semibold text-[#0079AC]">
          {KIND_LABEL[entry.kind].cta}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export default PortfolioCard;
