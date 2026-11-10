"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";
import { ImageView } from "./ImageView";

export interface ServiceCardProps {
  /** Unique service or capability identifier. */
  id: string;
  /** Primary card heading. */
  title: string;
  /** Concise value-focused description. */
  description: string;
  /** Optional subtitle / value tagline above the description. */
  tagline?: string;
  /** Dedicated service image source path. */
  imageSrc: string | undefined;
  /** Contextual, descriptive alt text. */
  imageAlt: string;
  /** Destination route URL. */
  href: string;
  /** Optional category / solution pillar badge. */
  category?: string;
  /** Optional verified feature or technology badges. */
  badges?: readonly string[];
  /** Optional TECH360 icon name from `./icons`. */
  icon?: string;
  /** Optional call-to-action label at the bottom of the card. */
  ctaLabel?: string;
  /** Standardized grid aspect ratio (`16/10` default). */
  aspect?: "16/10" | "4/3";
  /** Prioritize loading when rendered above the fold. */
  eager?: boolean;
  /** Responsive image `sizes` hint. */
  sizes?: string;
  className?: string;
}

/**
 * Reusable TECH360 Grid Card System (`ServiceCard`)
 *
 * Enforces equal-height cards, a locked 16:10 image container with zero
 * distortion, WCAG-compliant focus rings, reduced-motion safety, and balanced
 * enterprise typography across 1-column mobile, 2-column tablet, and 3-column
 * desktop grids.
 */
export function ServiceCard({
  id,
  title,
  description,
  tagline,
  imageSrc,
  imageAlt,
  href,
  category,
  badges,
  icon,
  ctaLabel = "Explore service",
  aspect = "16/10",
  eager = false,
  sizes = "(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw",
  className,
}: ServiceCardProps) {
  return (
    <article
      data-service-id={id}
      className={cn("h-full", className)}
    >
      <a
        href={href}
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white",
          "shadow-[0_2px_10px_rgba(11,31,51,0.05)] outline-none",
          "transition-[transform,box-shadow,border-color] duration-300 ease-out",
          "hover:-translate-y-1 hover:border-[#009FE3]/55 hover:shadow-[0_16px_38px_rgba(6,59,143,0.12)]",
          "focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        )}
      >
        {/* Standardized 16:10 visual frame */}
        <div className="relative w-full shrink-0 overflow-hidden border-b border-[#E2E8F0]/80 bg-[#061528]">
          <ImageView
            src={imageSrc}
            alt={imageAlt}
            aspect={aspect}
            width={1600}
            height={aspect === "16/10" ? 1000 : 1200}
            sizes={sizes}
            eager={eager}
            imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#040E1C]/55 to-transparent"
          />
          {category ? (
            <span className="absolute left-3.5 top-3.5 inline-flex items-center rounded-full border border-white/20 bg-[#061528]/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#9BEBFF] backdrop-blur-sm">
              {category}
            </span>
          ) : null}
        </div>

        {/* Equal-height content body */}
        <div className="flex flex-1 flex-col p-6">
          {icon ? (
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#009FE3]/10 text-[#0079AC] transition-colors duration-200 group-hover:bg-[#063B8F] group-hover:text-white motion-reduce:transition-none">
                <Icon name={icon} className="size-5" />
              </span>
              {badges && badges.length > 0 ? (
                <span className="truncate rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-[#475569]">
                  {badges.slice(0, 2).join(" · ")}
                </span>
              ) : null}
            </div>
          ) : null}

          <h3 className="text-lg font-bold leading-snug tracking-tight text-[#0B1F33] transition-colors group-hover:text-[#063B8F]">
            {title}
          </h3>

          {tagline ? (
            <p className="mt-1 text-xs font-semibold text-[#0079AC]">{tagline}</p>
          ) : null}

          <p className="mt-2.5 line-clamp-3 flex-1 text-sm leading-relaxed text-[#475569]">
            {description}
          </p>

          {!icon && badges && badges.length > 0 ? (
            <ul
              aria-label={`${title} highlights`}
              className="mt-4 flex flex-wrap gap-1.5"
            >
              {badges.slice(0, 3).map((badge) => (
                <li
                  key={badge}
                  className="line-clamp-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-[#475569]"
                >
                  {badge}
                </li>
              ))}
            </ul>
          ) : null}

          <span className="mt-5 inline-flex items-center gap-1.5 border-t border-[#F1F5F9] pt-4 text-sm font-semibold text-[#0079AC] transition-colors group-hover:text-[#063B8F]">
            {ctaLabel}
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </span>
        </div>
      </a>
    </article>
  );
}

export default ServiceCard;
