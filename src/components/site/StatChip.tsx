"use client";

import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/**
 * A qualitative differentiator chip — value + label + honest note.
 * Deliberately avoids fabricated counters; notes are verifiable facts.
 */
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
          "flex h-full flex-col rounded-xl p-5 transition-colors sm:p-6",
          dark
            ? "border border-white/10 bg-white/5 hover:border-[#009FE3]/40"
            : "border border-[#E2E8F0] bg-white hover:border-[#009FE3]/40"
        )}
      >
        <span className="text-2xl font-bold tracking-tight text-[#009FE3] sm:text-3xl">
          {value}
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
