"use client";

import { SectionHeading } from "./SectionHeading";
import { AIAssistantLink, PrimaryLink } from "./buttons";

/**
 * Closing call-to-action band used across views: deep gradient,
 * one message, two honest next steps (project form / AI assistant chat).
 */
export function CtaBand({
  title = "Ready to see your project before you pay for it?",
  description = "Send one message. You will get a written scope, an HTML preview of your solution, and a milestone plan — before any payment decision.",
  primaryLabel = "Start Your Project",
  primaryHref = "#/contact",
}: {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#063B8F] via-[#08296B] to-[#0B1F33]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#009FE3]/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-[#18B83A]/10 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <SectionHeading
          eyebrow="Next step"
          title={title}
          description={description}
          dark
        />
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <PrimaryLink href={primaryHref}>{primaryLabel}</PrimaryLink>
          <AIAssistantLink />
        </div>
        <p className="mt-6 text-xs text-white/50">
          Every engagement is on-record: Client ID, written scope, verified payments, full handover.
        </p>
      </div>
    </section>
  );
}
