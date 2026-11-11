/**
 * Node-only evidence audit for the solution maturity ledger.
 *
 * Kept out of `./maturity.ts` so the assessment model stays importable from
 * client components (the public industry page renders badges in the browser).
 * This module touches the filesystem and must only be imported from server code
 * and tests.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import type { SolutionMaturity } from "./types";
import {
  assessSolution,
  MATURITY_ORDER,
  SOLUTION_EVIDENCE,
  type SolutionEvidence,
} from "./maturity";

export interface EvidenceAudit {
  /** Evidence references that do not exist on disk. */
  missingPaths: { moduleId: string; key: keyof SolutionEvidence; value: string }[];
  /** Solutions whose claimed status exceeds their evidence. */
  overclaims: { moduleId: string; claimed: SolutionMaturity; status: SolutionMaturity }[];
  /** Count of solutions at each status. */
  counts: Record<SolutionMaturity, number>;
  /** Total solutions audited. */
  total: number;
}

/**
 * Verify the evidence ledger against the working tree.
 *
 * Used by `tests/solution-maturity.test.ts` so a badge can never point at a
 * path that does not exist, and a claim can never outrun its evidence.
 */
export function verifySolutionEvidence(
  claims: ReadonlyArray<{ id: string; claimed?: SolutionMaturity }>,
  options: { rootDir?: string; ledger?: Readonly<Record<string, SolutionEvidence>> } = {},
): EvidenceAudit {
  const rootDir = options.rootDir ?? process.cwd();
  const ledger = options.ledger ?? SOLUTION_EVIDENCE;
  const missingPaths: EvidenceAudit["missingPaths"] = [];
  const overclaims: EvidenceAudit["overclaims"] = [];
  const counts = Object.fromEntries(MATURITY_ORDER.map((s) => [s, 0])) as Record<
    SolutionMaturity,
    number
  >;

  for (const claim of claims) {
    const assessment = assessSolution(claim.id, claim.claimed ?? "SPECIFIED", ledger);
    counts[assessment.status] += 1;
    if (assessment.capped) {
      overclaims.push({ moduleId: claim.id, claimed: assessment.claimed, status: assessment.status });
    }
    const evidence = ledger[claim.id];
    if (!evidence) continue;
    for (const key of Object.keys(evidence) as (keyof SolutionEvidence)[]) {
      const value = evidence[key];
      const values = Array.isArray(value) ? value : value ? [value] : [];
      for (const entry of values) {
        // Routes are served by the router, not files; a demo route must be a
        // path and is checked by the routing test instead.
        if (key === "demoRoute") continue;
        const target = entry.replace(/^\//, "");
        if (!existsSync(join(rootDir, target))) {
          missingPaths.push({ moduleId: claim.id, key, value: entry });
        }
      }
    }
  }

  return { missingPaths, overclaims, counts, total: claims.length };
}
