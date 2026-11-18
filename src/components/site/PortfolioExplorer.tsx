"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import {
  KIND_LABEL,
  PORTFOLIO,
  PORTFOLIO_CAPABILITIES,
  PORTFOLIO_INDUSTRIES,
  queryPortfolio,
  type PortfolioEntry,
} from "@/data/portfolio";
import { cn } from "@/lib/utils";
import {
  createExplorerHistory,
  defaultExplorerState,
  KINDS,
  type CommitMode,
  type ExplorerHistory,
  type ExplorerState,
  type KindFilter,
  type SortKey,
} from "@/lib/portfolio/explorer-url";
import { PortfolioCard } from "./PortfolioCard";

/* ---------------------------------------------------------------- URL sync */

/*
 * Filter state ⇄ URL lives in src/lib/portfolio/explorer-url.ts (unit-tested):
 * discrete changes push one history entry (Back/Forward restore filters),
 * search typing pushes once per burst then replaces, and reloads/deep links
 * re-read the URL. Clean paths (`/work?industry=…`) and in-app hash routes
 * (`/#/work?industry=…`) are both supported.
 */

const VOCABULARY = { industries: PORTFOLIO_INDUSTRIES, capabilities: PORTFOLIO_CAPABILITIES };

const SORTS: { id: SortKey; label: string }[] = [
  { id: "featured", label: "Featured first" },
  { id: "az", label: "Title A–Z" },
  { id: "industry", label: "Industry" },
];

function sortEntries(entries: PortfolioEntry[], sort: SortKey): PortfolioEntry[] {
  const copy = [...entries];
  if (sort === "az") return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "industry")
    return copy.sort(
      (a, b) =>
        PORTFOLIO_INDUSTRIES.indexOf(a.industry) - PORTFOLIO_INDUSTRIES.indexOf(b.industry) ||
        a.title.localeCompare(b.title),
    );
  return copy.sort((a, b) => Number(b.featured) - Number(a.featured));
}

export function PortfolioExplorer({
  initialKind = "all",
  headingId = "portfolio-explorer-heading",
  priorityCount = 0,
}: {
  initialKind?: KindFilter;
  headingId?: string;
  priorityCount?: number;
}) {
  const defaults: ExplorerState = defaultExplorerState(initialKind);
  const [state, setState] = useState<ExplorerState>(defaults);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const historyRef = useRef<ExplorerHistory | null>(null);
  /** How the next state change should be written to history (null = do not write). */
  const pendingMode = useRef<CommitMode | null>(null);

  // Hydrate from the URL on mount and follow Back/Forward (popstate) afterwards.
  useEffect(() => {
    const controller = createExplorerHistory({
      win: window,
      initialKind,
      vocabulary: VOCABULARY,
      onNavigate: (next) => {
        pendingMode.current = null; // the URL already matches — never write back
        setState(next);
      },
    });
    historyRef.current = controller;
    pendingMode.current = null;
    setState(controller.read());
    return () => {
      controller.destroy();
      historyRef.current = null;
    };
  }, [initialKind]);

  // Same-page shortcuts (e.g. the "Browse by industry" strip) set a filter without navigating.
  useEffect(() => {
    const onFilter = (event: Event) => {
      const detail = (event as CustomEvent<{ industry?: string; capability?: string }>).detail ?? {};
      pendingMode.current = "push";
      setState((current) => ({
        ...current,
        industry: detail.industry ?? current.industry,
        capability: detail.capability ?? current.capability,
      }));
    };
    window.addEventListener("t360-portfolio-filter", onFilter);
    return () => window.removeEventListener("t360-portfolio-filter", onFilter);
  }, []);

  // Write user-initiated changes to the URL (one entry per discrete change).
  useEffect(() => {
    const mode = pendingMode.current;
    pendingMode.current = null;
    if (mode) historyRef.current?.commit(state, mode);
  }, [state]);

  const results = useMemo(
    () =>
      sortEntries(
        queryPortfolio({ kind: state.kind, industry: state.industry, capability: state.capability, q: state.q }),
        state.sort,
      ),
    [state],
  );

  /** Facet counts honour every other active filter, so a chip never leads to zero results unexpectedly. */
  const kindCounts = useMemo(() => {
    const base = queryPortfolio({ industry: state.industry, capability: state.capability, q: state.q });
    return {
      all: base.length,
      blueprint: base.filter((entry) => entry.kind === "blueprint").length,
      system: base.filter((entry) => entry.kind === "system").length,
    };
  }, [state.industry, state.capability, state.q]);

  const industryCounts = useMemo(() => {
    const base = queryPortfolio({ kind: state.kind, capability: state.capability, q: state.q });
    return Object.fromEntries(PORTFOLIO_INDUSTRIES.map((industry) => [industry, base.filter((e) => e.industry === industry).length]));
  }, [state.kind, state.capability, state.q]);

  const capabilityCounts = useMemo(() => {
    const base = queryPortfolio({ kind: state.kind, industry: state.industry, q: state.q });
    return Object.fromEntries(
      PORTFOLIO_CAPABILITIES.map((capability) => [capability, base.filter((e) => e.capabilities.includes(capability)).length]),
    );
  }, [state.kind, state.industry, state.q]);

  const active = state.industry || state.capability || state.q || state.kind !== initialKind || state.sort !== "featured";
  const reset = () => {
    pendingMode.current = "push";
    setState(defaults);
  };
  const update = (patch: Partial<ExplorerState>, mode: CommitMode = "push") => {
    pendingMode.current = mode;
    setState((current) => ({ ...current, ...patch }));
  };

  return (
    <div>
      {/* Controls */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search the portfolio</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8A9AAB]" aria-hidden="true" />
            <input
              type="search"
              value={state.q}
              maxLength={80}
              onChange={(event) => update({ q: event.target.value }, "typing")}
              placeholder="Search by system, industry, stage or technology — e.g. “WhatsApp”, “clinic”, “Prisma”"
              className="min-h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pl-10 pr-3 text-sm text-[#0B1F33] outline-none placeholder:text-[#8A9AAB] focus:border-[#009FE3] focus:bg-white focus:ring-2 focus:ring-[#009FE3]/30"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="sr-only">Industry</span>
              <select
                value={state.industry}
                onChange={(event) => update({ industry: event.target.value })}
                className="min-h-11 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0B1F33] outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/30"
              >
                <option value="">All industries</option>
                {PORTFOLIO_INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry} disabled={industryCounts[industry] === 0 && state.industry !== industry}>
                    {industry} ({industryCounts[industry]})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="sr-only">Capability</span>
              <select
                value={state.capability}
                onChange={(event) => update({ capability: event.target.value })}
                className="min-h-11 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0B1F33] outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/30"
              >
                <option value="">All capabilities</option>
                {PORTFOLIO_CAPABILITIES.map((capability) => (
                  <option key={capability} value={capability} disabled={capabilityCounts[capability] === 0 && state.capability !== capability}>
                    {capability} ({capabilityCounts[capability]})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="sr-only">Sort</span>
              <select
                value={state.sort}
                onChange={(event) => update({ sort: event.target.value as SortKey })}
                className="min-h-11 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0B1F33] outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/30"
              >
                {SORTS.map((sort) => (
                  <option key={sort.id} value={sort.id}>
                    Sort: {sort.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
            {KINDS.map((kind) => {
              const selected = state.kind === kind;
              const label = kind === "all" ? "All work" : KIND_LABEL[kind].plural;
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ kind })}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2",
                    selected
                      ? "bg-[#063B8F] text-white"
                      : "border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:border-[#009FE3] hover:text-[#063B8F]",
                  )}
                >
                  {label}
                  <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", selected ? "bg-white/20" : "bg-[#E2E8F0]")}>
                    {kindCounts[kind]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {active ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#063B8F] outline-none hover:bg-[#F1F6FB] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Clear all
              </button>
            ) : null}
            <div role="group" aria-label="Layout" className="flex rounded-full border border-[#E2E8F0] p-0.5">
              {(["grid", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={layout === mode}
                  aria-label={mode === "grid" ? "Grid view" : "List view"}
                  onClick={() => setLayout(mode)}
                  className={cn(
                    "grid size-9 place-items-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-[#009FE3]",
                    layout === mode ? "bg-[#063B8F] text-white" : "text-[#526173] hover:text-[#063B8F]",
                  )}
                >
                  {mode === "grid" ? <LayoutGrid className="size-4" aria-hidden="true" /> : <List className="size-4" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Result summary */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p id={headingId} className="flex items-center gap-2 text-sm text-[#526173]" role="status" aria-live="polite">
          <SlidersHorizontal className="size-4 text-[#009FE3]" aria-hidden="true" />
          Showing <strong className="text-[#0B1F33]">{results.length}</strong> of {PORTFOLIO.length} entries
          {state.industry ? <> in <strong className="text-[#0B1F33]">{state.industry}</strong></> : null}
          {state.capability ? <> · <strong className="text-[#0B1F33]">{state.capability}</strong></> : null}
          {state.q.trim() ? <> matching “<strong className="text-[#0B1F33]">{state.q.trim()}</strong>”</> : null}
        </p>
      </div>

      {results.length ? (
        <ul
          className={cn(
            "mt-5 grid gap-6",
            layout === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
          )}
        >
          {results.map((entry, index) => (
            <li key={`${entry.kind}-${entry.slug}`} className="h-full">
              <PortfolioCard entry={entry} layout={layout} priority={index < priorityCount} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-12 text-center">
          <p className="text-base font-semibold text-[#0B1F33]">No portfolio entries match these filters.</p>
          <p className="mt-2 text-sm text-[#526173]">
            Try a broader search, or tell us about your system — most engagements combine several of these patterns.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#063B8F] outline-none hover:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset filters
            </button>
            <a
              href="/contact"
              className="inline-flex min-h-11 items-center rounded-lg bg-[#063B8F] px-4 text-sm font-semibold text-white outline-none hover:bg-[#052f72] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
            >
              Describe your project
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default PortfolioExplorer;
