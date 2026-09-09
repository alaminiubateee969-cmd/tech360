"use client";

import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/**
 * Consistent section heading: small eyebrow, large confident title,
 * optional supporting paragraph. Alignable and dark-section aware.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  dark = false,
  className,
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  dark?: boolean;
  className?: string;
  /** Applied to the h2 so sections can reference it via aria-labelledby. */
  id?: string;
}) {
  return (
    <Reveal
      className={cn(
        "max-w-3xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "mb-3 text-xs font-semibold uppercase tracking-[0.22em]",
            dark ? "text-[#7FD4FF]" : "text-[#009FE3]"
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        id={id}
        className={cn(
          "text-3xl font-bold tracking-tight sm:text-4xl",
          dark ? "text-white" : "text-[#0B1F33]"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed sm:text-lg",
            dark ? "text-white/70" : "text-[#526173]"
          )}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
