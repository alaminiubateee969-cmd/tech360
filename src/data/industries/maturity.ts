/**
 * Solution maturity — the evidence gate between "specified" and "shipped".
 *
 * Every industry solution in this repository is a *specification*. None of them
 * is a delivered client system, a working demonstration, or a deployed
 * application. The public site must therefore never present a specification as
 * a finished product — that is the honesty rule the master brief states
 * explicitly ("Do not claim all 160 solutions are ready-to-deploy applications
 * unless they are actually implemented and tested").
 *
 * This module makes the claim machine-checkable rather than a matter of copy
 * discipline:
 *
 *   1. A solution may only reach `DEMO AVAILABLE` if a real demo route exists
 *      in this repository and is listed in `SOLUTION_EVIDENCE`.
 *   2. It may only reach `IMPLEMENTED` / `TESTED` / `DEPLOYABLE` if committed
 *      source paths and test files are listed and actually exist on disk
 *      (`verifySolutionEvidence()` in `./maturity-verify.ts`, which is
 *      Node-only and used by the test suite — this module stays browser-safe).
 *   3. Anything without evidence is capped at `SPECIFIED` — a full 22-field
 *      specification is a real deliverable, and it is the correct label for
 *      what this repository contains.
 *
 * Adding a real implementation therefore requires an evidence record, not a
 * copy change. Removing evidence automatically demotes the badge.
 */

import type { SolutionMaturity } from "./types";

/** Ordered lifecycle. Index is the maturity rank. */
export const MATURITY_ORDER: readonly SolutionMaturity[] = [
  "CONCEPT",
  "SPECIFIED",
  "DESIGN READY",
  "DEMO AVAILABLE",
  "IMPLEMENTED",
  "TESTED",
  "DEPLOYABLE",
] as const;

export interface MaturityMeta {
  /** Badge label. */
  label: string;
  /** What the status proves. */
  proves: string;
  /** What the status explicitly does NOT prove. */
  doesNotProve: string;
  /** Tone token used by the UI. */
  tone: "neutral" | "info" | "design" | "demo" | "success";
}

export const MATURITY_META: Record<SolutionMaturity, MaturityMeta> = {
  CONCEPT: {
    label: "Concept",
    proves: "A named idea and the problem it addresses.",
    doesNotProve: "No specification, design, build or demonstration exists.",
    tone: "neutral",
  },
  SPECIFIED: {
    label: "Specified",
    proves:
      "A complete 22-field specification: capabilities, roles, entities, workflows, KPIs, AI use cases, controls, SLA, acceptance criteria.",
    doesNotProve: "Nothing has been designed, built, demonstrated or tested.",
    tone: "info",
  },
  "DESIGN READY": {
    label: "Design ready",
    proves: "Interface and data-design artifacts exist for this solution.",
    doesNotProve: "No working software exists.",
    tone: "design",
  },
  "DEMO AVAILABLE": {
    label: "Demo available",
    proves:
      "A public, sample-data demonstration of this solution can be opened in the browser.",
    doesNotProve: "A demonstration is not a production deployment and holds no client data.",
    tone: "demo",
  },
  IMPLEMENTED: {
    label: "Implemented",
    proves: "Committed source code implementing this solution exists in this repository.",
    doesNotProve: "Not yet covered by an automated test suite, and not deployed.",
    tone: "success",
  },
  TESTED: {
    label: "Tested",
    proves: "Implementation plus committed automated tests exercising it.",
    doesNotProve: "Not necessarily deployed to a production environment.",
    tone: "success",
  },
  DEPLOYABLE: {
    label: "Deployable",
    proves:
      "Implementation, tests, and a recorded verified deployment path (health checks, rollback).",
    doesNotProve: "Deployable is not the same as deployed for a client.",
    tone: "success",
  },
};

/**
 * Evidence required to *claim* each level. A claim is only honoured when the
 * matching evidence is present; otherwise the solution is capped below it.
 */
export const REQUIRED_EVIDENCE: Record<SolutionMaturity, readonly (keyof SolutionEvidence)[]> = {
  CONCEPT: [],
  SPECIFIED: [],
  "DESIGN READY": ["designArtifacts"],
  "DEMO AVAILABLE": ["demoRoute"],
  IMPLEMENTED: ["sourcePaths"],
  TESTED: ["sourcePaths", "testFiles"],
  DEPLOYABLE: ["sourcePaths", "testFiles", "deploymentEvidence"],
};

export interface SolutionEvidence {
  /** Design artifacts (Figma/spec exports, design kit paths) committed to the repo. */
  designArtifacts?: string[];
  /** Public demo route that actually exists (must start with `/`). */
  demoRoute?: string;
  /** Committed implementation files/directories. */
  sourcePaths?: string[];
  /** Committed automated tests. */
  testFiles?: string[];
  /** Committed deployment/rollback verification record. */
  deploymentEvidence?: string[];
}

/**
 * The evidence ledger. Keyed by module ID (the solution specification ID).
 *
 * EMPTY BY DESIGN: this repository contains specifications and a governed
 * delivery platform, but no industry solution has been implemented, tested or
 * deployed for a client. Adding an entry is the only way a badge can rise
 * above "Specified", which keeps the public site truthful by construction.
 */
export const SOLUTION_EVIDENCE: Readonly<Record<string, SolutionEvidence>> = {};

export interface SolutionAssessment {
  /** Final, evidence-capped status. */
  status: SolutionMaturity;
  /** Rank (0–6) of `status`. */
  rank: number;
  /** Status the specification asked for, before the evidence cap. */
  claimed: SolutionMaturity;
  /** True when evidence capped the claim. */
  capped: boolean;
  /** Which evidence keys were satisfied. */
  satisfied: readonly (keyof SolutionEvidence)[];
  /** Which evidence keys were missing and caused the cap. */
  missing: readonly (keyof SolutionEvidence)[];
  /** Human-readable explanation for the UI. */
  explanation: string;
}

/** Rank of a maturity status (0 = CONCEPT). */
export function maturityRank(status: SolutionMaturity): number {
  const index = MATURITY_ORDER.indexOf(status);
  return index === -1 ? 0 : index;
}

function hasEvidence(value: SolutionEvidence[keyof SolutionEvidence] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.length > 0;
}

/**
 * Highest status the evidence honestly supports.
 * Evidence is cumulative: TESTED implies IMPLEMENTED, DEPLOYABLE implies both.
 */
export function evidenceCeiling(evidence: SolutionEvidence | undefined): SolutionMaturity {
  if (!evidence) return "SPECIFIED";
  const present = (key: keyof SolutionEvidence) => hasEvidence(evidence[key]);

  if (present("sourcePaths") && present("testFiles") && present("deploymentEvidence")) {
    return "DEPLOYABLE";
  }
  if (present("sourcePaths") && present("testFiles")) return "TESTED";
  if (present("sourcePaths")) return "IMPLEMENTED";
  if (present("demoRoute")) return "DEMO AVAILABLE";
  if (present("designArtifacts")) return "DESIGN READY";
  return "SPECIFIED";
}

/**
 * Assess one solution. `claimed` defaults to `SPECIFIED`, which is what every
 * specification in this repository legitimately is.
 */
export function assessSolution(
  moduleId: string,
  claimed: SolutionMaturity = "SPECIFIED",
  ledger: Readonly<Record<string, SolutionEvidence>> = SOLUTION_EVIDENCE,
): SolutionAssessment {
  const evidence = ledger[moduleId];
  const ceiling = evidenceCeiling(evidence);
  const requestedRank = maturityRank(claimed);
  const ceilingRank = maturityRank(ceiling);
  const capped = requestedRank > ceilingRank;
  const status = capped ? ceiling : claimed;
  const required = REQUIRED_EVIDENCE[claimed];
  const satisfied = required.filter((key) => hasEvidence(evidence?.[key]));
  const missing = required.filter((key) => !hasEvidence(evidence?.[key]));

  const explanation = capped
    ? `Capped at “${MATURITY_META[status].label}”: no evidence in this repository supports “${MATURITY_META[claimed].label}”.`
    : evidence
      ? `“${MATURITY_META[status].label}” supported by recorded evidence.`
      : `Specification only. No design artifact, demo route, source code, test or deployment evidence is recorded for ${moduleId}.`;

  return { status, rank: maturityRank(status), claimed, capped, satisfied, missing, explanation };
}

/** Aggregate status counts for a set of solution IDs. */
export function maturitySummary(moduleIds: readonly string[]): {
  total: number;
  counts: Record<SolutionMaturity, number>;
  byStatus: Record<SolutionMaturity, string[]>;
} {
  const counts = Object.fromEntries(MATURITY_ORDER.map((s) => [s, 0])) as Record<
    SolutionMaturity,
    number
  >;
  const byStatus = Object.fromEntries(
    MATURITY_ORDER.map((s) => [s, [] as string[]]),
  ) as Record<SolutionMaturity, string[]>;
  for (const id of moduleIds) {
    const { status } = assessSolution(id);
    counts[status] += 1;
    byStatus[status].push(id);
  }
  return { total: moduleIds.length, counts, byStatus };
}
