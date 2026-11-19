/**
 * Portfolio explorer ⇄ URL state, with predictable browser history.
 *
 * Behaviour (documented in docs/VISUAL_ASSET_MANIFEST.md §4.5):
 *  - Every filter is mirrored into the URL query, in a canonical order
 *    (type, industry, capability, q, sort). Defaults are omitted, so the
 *    unfiltered page keeps its clean URL.
 *  - Discrete changes (type chip, industry, capability, sort, clear) PUSH one
 *    history entry, so Back returns to the previous filter and Forward
 *    re-applies it.
 *  - Search typing pushes ONE entry when a typing burst starts and then
 *    replaces it while the visitor keeps typing (no entry per keystroke).
 *  - A change that produces the URL already in the address bar writes nothing
 *    (no duplicate entries).
 *  - Back/Forward fire `popstate` (hash links: `hashchange`); the controller parses the URL and hands the
 *    state to the view WITHOUT writing history, so there is no sync loop.
 *  - Invalid values (unknown industry, bad type, oversized query) fall back to
 *    defaults on read, and the initial read canonicalises the URL with
 *    replaceState (never adds an entry).
 *  - Works for both URL forms the site uses: clean paths (`/work?industry=…`)
 *    and in-app hash routes (`/any#/work?industry=…`).
 */

export type KindFilter = "all" | "blueprint" | "system";
export type SortKey = "featured" | "az" | "industry";

export interface ExplorerState {
  kind: KindFilter;
  industry: string;
  capability: string;
  q: string;
  sort: SortKey;
}

export interface ExplorerVocabulary {
  industries: readonly string[];
  capabilities: readonly string[];
}

export const KINDS: readonly KindFilter[] = ["all", "blueprint", "system"];
export const SORT_KEYS: readonly SortKey[] = ["featured", "az", "industry"];
export const MAX_QUERY_LENGTH = 80;
/** A pause longer than this ends a search-typing burst. */
export const TYPING_BURST_MS = 1200;

export function defaultExplorerState(initialKind: KindFilter): ExplorerState {
  return { kind: initialKind, industry: "", capability: "", q: "", sort: "featured" };
}

export function parseExplorerState(
  params: URLSearchParams,
  initialKind: KindFilter,
  vocabulary: ExplorerVocabulary,
): ExplorerState {
  const kind = params.get("type");
  const sort = params.get("sort");
  const industry = params.get("industry") ?? "";
  const capability = params.get("capability") ?? "";
  return {
    kind: KINDS.includes(kind as KindFilter) ? (kind as KindFilter) : initialKind,
    industry: vocabulary.industries.includes(industry) ? industry : "",
    capability: vocabulary.capabilities.includes(capability) ? capability : "",
    q: (params.get("q") ?? "").replace(/\s+/g, " ").trimStart().slice(0, MAX_QUERY_LENGTH),
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "featured",
  };
}

export function serializeExplorerState(state: ExplorerState, initialKind: KindFilter): string {
  const params = new URLSearchParams();
  if (state.kind !== initialKind) params.set("type", state.kind);
  if (state.industry) params.set("industry", state.industry);
  if (state.capability) params.set("capability", state.capability);
  const q = state.q.trim();
  if (q) params.set("q", q);
  if (state.sort !== "featured") params.set("sort", state.sort);
  return params.toString();
}

export function sameExplorerState(a: ExplorerState, b: ExplorerState): boolean {
  return (
    a.kind === b.kind &&
    a.industry === b.industry &&
    a.capability === b.capability &&
    a.q.trim() === b.q.trim() &&
    a.sort === b.sort
  );
}

export interface LocationLike {
  pathname: string;
  search: string;
  hash: string;
}

/** Query string for the explorer, from whichever URL form is in use. */
export function readLocationQuery(location: LocationLike): string {
  if (location.hash.startsWith("#/")) {
    const index = location.hash.indexOf("?");
    return index === -1 ? "" : location.hash.slice(index + 1);
  }
  return location.search.replace(/^\?/, "");
}

/** The URL for `query` in the same form as `location` (hash route or clean path). */
export function buildLocationUrl(location: LocationLike, query: string): string {
  if (location.hash.startsWith("#/")) {
    const route = location.hash.slice(1).split("?")[0];
    return `${location.pathname}${location.search}#${route}${query ? `?${query}` : ""}`;
  }
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}

export interface HistoryWindow {
  location: LocationLike;
  history: {
    readonly state: unknown;
    pushState(data: unknown, unused: string, url?: string | null): void;
    replaceState(data: unknown, unused: string, url?: string | null): void;
  };
  addEventListener(type: "popstate" | "hashchange", listener: () => void): void;
  removeEventListener(type: "popstate" | "hashchange", listener: () => void): void;
}

export type CommitMode = "push" | "replace" | "typing";

export interface ExplorerHistoryOptions {
  win: HistoryWindow;
  initialKind: KindFilter;
  vocabulary: ExplorerVocabulary;
  /** Called with the state parsed from the URL after Back/Forward. */
  onNavigate: (state: ExplorerState) => void;
  now?: () => number;
}

export interface ExplorerHistory {
  /** State from the current URL; canonicalises the URL with replaceState. */
  read(): ExplorerState;
  /** Write `state` to the URL according to `mode`. No-op if the URL would not change. */
  commit(state: ExplorerState, mode: CommitMode): void;
  destroy(): void;
}

const HISTORY_MARK = "t360PortfolioFilter";

export function createExplorerHistory(options: ExplorerHistoryOptions): ExplorerHistory {
  const { win, initialKind, vocabulary, onNavigate } = options;
  const now = options.now ?? (() => Date.now());
  let lastTypingAt = Number.NEGATIVE_INFINITY;
  let destroyed = false;

  const currentUrl = () => `${win.location.pathname}${win.location.search}${win.location.hash}`;
  const parseCurrent = () =>
    parseExplorerState(new URLSearchParams(readLocationQuery(win.location)), initialKind, vocabulary);

  /**
   * History state for our entries: only our own marker. Framework keys are
   * deliberately NOT copied here — Next.js patches pushState/replaceState and
   * copies its own router state (`__NA`, tree) into external entries itself,
   * which also keeps useSearchParams in sync. Passing `__NA` ourselves would
   * bypass that sync.
   */
  const entryState = (query: string) => ({ [HISTORY_MARK]: query });

  const onPopState = () => {
    if (destroyed) return;
    lastTypingAt = Number.NEGATIVE_INFINITY; // a navigation ends any typing burst
    onNavigate(parseCurrent());
  };
  // Back/Forward fire popstate; in-app hash links (e.g. "Work" while on a
  // filtered `#/work?…`) fire hashchange — not every engine fires popstate for
  // fragment navigations. Handling both is idempotent.
  win.addEventListener("popstate", onPopState);
  win.addEventListener("hashchange", onPopState);

  return {
    read() {
      const state = parseCurrent();
      const canonical = buildLocationUrl(win.location, serializeExplorerState(state, initialKind));
      if (canonical !== currentUrl()) win.history.replaceState(entryState(serializeExplorerState(state, initialKind)), "", canonical);
      return state;
    },
    commit(state, mode) {
      if (destroyed) return;
      const query = serializeExplorerState(state, initialKind);
      const next = buildLocationUrl(win.location, query);
      if (next === currentUrl()) return;
      let push = mode === "push";
      if (mode === "typing") {
        const t = now();
        push = t - lastTypingAt > TYPING_BURST_MS;
        lastTypingAt = t;
      } else {
        lastTypingAt = Number.NEGATIVE_INFINITY;
      }
      if (push) win.history.pushState(entryState(query), "", next);
      else win.history.replaceState(entryState(query), "", next);
    },
    destroy() {
      destroyed = true;
      win.removeEventListener("popstate", onPopState);
      win.removeEventListener("hashchange", onPopState);
    },
  };
}
