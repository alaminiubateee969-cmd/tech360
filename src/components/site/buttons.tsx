"use client";

import { ArrowRight, Bot, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Anchor-based buttons (44px touch targets, focus rings, brand palette).
 * Navigation uses real hash hrefs — page.tsx's hash router picks these up.
 */

const BASE =
  "group/btn inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 disabled:opacity-60";

export function PrimaryLink({
  href,
  children,
  className,
  external = false,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={onClick}
      className={cn(
        BASE,
        "bg-[#009FE3] text-white shadow-[0_1px_2px_rgba(6,59,143,0.25)] hover:bg-[#0090CC] hover:shadow-[0_4px_14px_rgba(0,159,227,0.35)]",
        className
      )}
    >
      {children}
    </a>
  );
}

export function OutlineLink({
  href,
  children,
  className,
  dark = false,
  external = false,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
  external?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={onClick}
      className={cn(
        BASE,
        dark
          ? "border border-white/30 bg-white/5 text-white hover:border-white/60 hover:bg-white/10"
          : "border border-[#063B8F]/20 bg-white text-[#063B8F] hover:border-[#009FE3] hover:text-[#009FE3]",
        className
      )}
    >
      {children}
    </a>
  );
}

/** Opens the on-site AI assistant (ChatWidget) — the primary contact channel. */
export function AIAssistantLink({
  label = "Chat with our AI assistant",
  className,
  compact = false,
}: {
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("tech360:open-chat"))
      }
      aria-label="Open the Tech360 AI assistant chat"
      className={cn(
        BASE,
        "bg-[#18B83A] text-white shadow-[0_1px_2px_rgba(6,59,143,0.2)] hover:bg-[#16A433] hover:shadow-[0_4px_14px_rgba(24,184,58,0.35)]",
        compact ? "min-h-9 px-3.5 py-1.5 text-xs" : "",
        className
      )}
    >
      <Bot className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * Non-anchor "learn more" affordance for use INSIDE a card that is already a
 * link (nested <a> in <a> is invalid HTML and causes hydration errors).
 * Renders a <span> styled identically to LinkArrow; the arrow animates on the
 * parent card's group-hover instead.
 */
export function CardLinkAffordance({
  children,
  className,
  dark = false,
}: {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <span
      className={cn(
        "group/inline inline-flex items-center gap-1.5 text-sm font-semibold",
        dark ? "text-[#7FD4FF]" : "text-[#009FE3] group-hover:text-[#063B8F]",
        className
      )}
    >
      {children}
      <ArrowRight
        className="size-3.5 transition-transform group-hover:translate-x-1"
        aria-hidden="true"
      />
    </span>
  );
}

/** Inline text link with trailing arrow — for card "learn more" affordances. */
export function LinkArrow({
  href,
  children,
  className,
  dark = false,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "group/link inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 rounded-sm",
        dark ? "text-[#7FD4FF] hover:text-white" : "text-[#009FE3] hover:text-[#063B8F]",
        className
      )}
    >
      {children}
      {external ? (
        <ExternalLink className="size-3.5 transition-transform group-hover/link:-translate-y-0.5" aria-hidden="true" />
      ) : (
        <ArrowRight className="size-3.5 transition-transform group-hover/link:translate-x-1" aria-hidden="true" />
      )}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Additional variants (diagram-design / archify style: flat, hairline, */
/* 44px targets, one accent). No shadows on the quiet variants.        */
/* ------------------------------------------------------------------ */

/** Tonal button — lower emphasis than PrimaryLink, higher than OutlineLink. */
export function SecondaryLink({
  href,
  children,
  className,
  external = false,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={onClick}
      className={cn(
        BASE,
        "bg-[#009FE3]/10 text-[#063B8F] hover:bg-[#009FE3]/20",
        className
      )}
    >
      {children}
    </a>
  );
}

/** Text-only button for tertiary actions (no fill, no border). */
export function GhostLink({
  href,
  children,
  className,
  dark = false,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        BASE,
        "px-3",
        dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-[#063B8F] hover:bg-[#063B8F]/5",
        className
      )}
    >
      {children}
    </a>
  );
}

/**
 * Click-to-chat button using the public wa.me deep link (free, no API).
 * Renders nothing unless a number is supplied, so the site never shows a dead button.
 */
export function WhatsAppLink({
  number,
  message = "Hi Tech360, I'd like to discuss a project.",
  children = "Chat on WhatsApp",
  className,
}: {
  number?: string;
  message?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const digits = (number ?? "").replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  return (
    <a
      href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(BASE, "bg-[#25D366] text-[#073B1D] hover:bg-[#20BD5A]", className)}
    >
      {children}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

/** Lays out a row of buttons: stacked on mobile, inline from `sm`. */
export function ButtonGroup({
  children,
  className,
  align = "start",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
        align === "center" && "items-center justify-center",
        className
      )}
    >
      {children}
    </div>
  );
}
