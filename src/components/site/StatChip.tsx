"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/**
 * A qualitative differentiator chip — value + label + honest note.
 * Deliberately avoids fabricated counters; notes are verifiable facts.
 *
 * When the value is a clean number (or number + "+"), it animates with a
 * count-up on first view (IntersectionObserver + rAF, easeOutCubic). Text
 * values ("US LLC", ranges) render statically. prefers-reduced-motion is
 * respected — the count jumps to the final value on the first frame.
 */

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3);

function useCountUp(target: number, active: boolean, durationMs = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : durationMs;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
      setValue(Math.round(EASE_OUT(t) * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);
  return value;
}

function AnimatedValue({ raw }: { raw: string }) {
  // Only animate clean patterns: "20" or "100+" — everything else is static text.
  const match = /^(\d+)(\+?)$/.exec(raw.trim());
  const target = match ? Number(match[1]) : 0;
  const suffix = match?.[2] ?? "";
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const current = useCountUp(target, active && match != null);

  useEffect(() => {
    if (!match) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setActive(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [raw, match]);

  if (!match) {
    return <span ref={ref} className="tabular-nums">{raw}</span>;
  }
  return (
    <span ref={ref} className="tabular-nums" aria-label={raw}>
      {current}
      {suffix}
    </span>
  );
}

export function StatChip({
  value,
  label,
  note,
  dark = false,
  className,
}: {
  value: string;
  label: string;
  note?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <Reveal className={cn("h-full", className)}>
      <div
        className={cn(
          "group flex h-full flex-col rounded-xl p-5 transition-all duration-300 sm:p-6",
          dark
            ? "border border-white/10 bg-white/5 hover:border-[#009FE3]/40 hover:bg-white/[0.08]"
            : "border border-[#E2E8F0] bg-white hover:border-[#009FE3]/40 hover:shadow-[0_16px_40px_-24px_rgba(6,59,143,0.35)]"
        )}
      >
        <span
          className={cn(
            "text-2xl font-bold tracking-tight transition-transform duration-300 group-hover:-translate-y-0.5 sm:text-3xl",
            dark ? "text-[#4FC3F7]" : "text-[#009FE3]"
          )}
        >
          <AnimatedValue raw={value} />
        </span>
        <span
          className={cn(
            "mt-1 text-sm font-semibold",
            dark ? "text-white" : "text-[#0B1F33]"
          )}
        >
          {label}
        </span>
        {note ? (
          <span className={cn("mt-2 text-xs leading-relaxed", dark ? "text-white/60" : "text-[#526173]")}>
            {note}
          </span>
        ) : null}
      </div>
    </Reveal>
  );
}
