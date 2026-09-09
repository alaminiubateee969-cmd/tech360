"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/**
 * Inner-page hero: deep brand gradient, eyebrow, headline, lead paragraph
 * and breadcrumb trail. Used by every non-home view.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  breadcrumb,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  breadcrumb?: { label: string; href?: string }[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-[#063B8F] via-[#073a86] to-[#0B1F33]",
        className
      )}
      aria-labelledby="page-hero-title"
    >
      {/* subtle brand geometry — two soft radial washes, no decorative noise */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-10%] h-[26rem] w-[26rem] rounded-full bg-[#009FE3]/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-30%] left-[-8%] h-[22rem] w-[22rem] rounded-full bg-[#18B83A]/10 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-20">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/60">
              <li>
                <a
                  href="#/"
                  className="rounded-sm outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Home
                </a>
              </li>
              {breadcrumb.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5">
                  <ChevronRight className="size-3.5 opacity-50" aria-hidden="true" />
                  {item.href ? (
                    <a
                      href={item.href}
                      className="rounded-sm outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span aria-current="page" className="text-white/90">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <Reveal>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7FD4FF]">
            {eyebrow}
          </p>
          <h1
            id="page-hero-title"
            className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </Reveal>
      </div>
    </section>
  );
}
