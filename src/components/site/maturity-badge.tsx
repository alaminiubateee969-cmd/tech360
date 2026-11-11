"use client";

import type { SolutionMaturity } from "@/data/industries/types";
import { MATURITY_META, type SolutionAssessment } from "@/data/industries/maturity";

/**
 * Evidence-capped maturity badge.
 *
 * The badge always renders its label as text (never colour alone), and the
 * tooltip-style description states what the status proves and what it does
 * not. A capped claim shows the cap in the accessible name so a screen-reader
 * user gets the same information as a sighted one.
 */

const TONE_CLASSES: Record<SolutionMaturity, string> = {
  CONCEPT: "border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]",
  SPECIFIED: "border-[#009FE3]/35 bg-[#E8F6FD] text-[#06658F]",
  "DESIGN READY": "border-[#7C5CFF]/35 bg-[#F1EEFF] text-[#4B3AB8]",
  "DEMO AVAILABLE": "border-[#F5B301]/45 bg-[#FFF8E1] text-[#8A5A00]",
  IMPLEMENTED: "border-[#18B83A]/35 bg-[#EEFAF0] text-[#0F7A28]",
  TESTED: "border-[#18B83A]/45 bg-[#E4F7E8] text-[#0B6320]",
  DEPLOYABLE: "border-[#0F7A28]/45 bg-[#DDF3E2] text-[#0B6320]",
};

export function MaturityBadge({
  assessment,
  className = "",
}: {
  assessment: SolutionAssessment;
  className?: string;
}) {
  const meta = MATURITY_META[assessment.status];
  const title = assessment.capped
    ? `${meta.label} (claimed ${assessment.claimed}, capped by available evidence)`
    : meta.label;
  const description = `${meta.proves} ${meta.doesNotProve}`;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[assessment.status]} ${className}`}
      title={`${title}. ${description}`}
      aria-label={`Solution status: ${title}. ${description}`}
    >
      {meta.label}
    </span>
  );
}

export default MaturityBadge;
