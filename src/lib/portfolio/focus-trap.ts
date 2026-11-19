/**
 * Modal focus management for the portfolio image viewer (and any other dialog).
 *
 * A focus trap that only intercepts Tab is not enough, so this module does all
 * of it in one place:
 *
 *  - remembers the element that had focus when the dialog opened;
 *  - moves focus into the dialog (preferred element → first tabbable → container);
 *  - wraps Tab / Shift+Tab inside the dialog;
 *  - pulls focus back if it escapes by any other route (focusin guard);
 *  - makes everything OUTSIDE the dialog inert (`inert` + `aria-hidden`), while
 *    remembering and restoring each element's previous state, so screen
 *    readers and pointer users cannot reach the background either;
 *  - calls `onEscape` for the Escape key;
 *  - on deactivate, removes every listener, restores background interaction and
 *    returns focus to the opener — or to a fallback if the opener is gone.
 *
 * It is framework-free and only uses a small DOM surface, so it is unit-tested
 * with an in-memory DOM (tests/portfolio-focus-trap.test.ts). Activation and
 * deactivation are idempotent, which makes rapid open/close and unmount-while-
 * open safe.
 */

export const TABBABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** The minimal element surface the trap needs (satisfied by HTMLElement). */
export interface TrapElement {
  parentElement: TrapElement | null;
  readonly children: ArrayLike<TrapElement>;
  focus(options?: { preventScroll?: boolean }): void;
  contains(other: unknown): boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  hasAttribute(name: string): boolean;
  querySelectorAll(selector: string): ArrayLike<TrapElement>;
  tabIndex: number;
  readonly isConnected: boolean;
  inert?: boolean;
  hidden?: boolean;
}

export interface TrapKeyboardEvent {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
  stopPropagation?(): void;
}

/** The minimal document surface the trap needs (satisfied by Document). */
export interface TrapDocument {
  readonly activeElement: unknown;
  readonly body: TrapElement;
  addEventListener(type: string, listener: (event: never) => void, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: (event: never) => void, options?: boolean | EventListenerOptions): void;
}

export interface FocusTrapOptions {
  /** Defaults to the global `document`. */
  doc?: TrapDocument;
  /** Element to focus first; falls back to the first tabbable, then the container. */
  initialFocus?: () => TrapElement | null | undefined;
  /** Element to return focus to; defaults to whatever was focused on activate. */
  returnFocus?: TrapElement | null;
  /** Used when the opener is missing or detached at deactivate time. */
  fallbackFocus?: () => TrapElement | null | undefined;
  onEscape?: () => void;
  /** Override the tabbable query (tests / custom widgets). */
  getTabbables?: (container: TrapElement) => TrapElement[];
}

export interface FocusTrap {
  activate(): void;
  deactivate(): void;
  readonly active: boolean;
}

function isVisible(el: TrapElement): boolean {
  if (el.hidden) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  // Real browsers: zero client rects means display:none / detached.
  const rects = (el as unknown as { getClientRects?: () => ArrayLike<unknown> }).getClientRects;
  if (typeof rects === "function") return rects.call(el).length > 0;
  return true;
}

export function defaultTabbables(container: TrapElement): TrapElement[] {
  return Array.from(container.querySelectorAll(TABBABLE_SELECTOR)).filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute("disabled") && isVisible(el),
  );
}

interface BackgroundRecord {
  el: TrapElement;
  hadInert: boolean;
  ariaHidden: string | null;
}

/**
 * Collects every element outside the dialog that must be hidden: at each level
 * from the dialog up to <body>, all siblings of the dialog's ancestor chain.
 */
function backgroundElements(container: TrapElement, body: TrapElement): TrapElement[] {
  const out: TrapElement[] = [];
  let node: TrapElement | null = container;
  while (node && node !== body && node.parentElement) {
    const parent: TrapElement = node.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling !== node) out.push(sibling);
    }
    node = parent;
  }
  return out;
}

export function createFocusTrap(container: TrapElement, options: FocusTrapOptions = {}): FocusTrap {
  const doc = (options.doc ?? (globalThis as unknown as { document: TrapDocument }).document) as TrapDocument;
  const tabbables = () => (options.getTabbables ?? defaultTabbables)(container);
  let active = false;
  let opener: TrapElement | null = null;
  let background: BackgroundRecord[] = [];

  const focusFirst = () => {
    const preferred = options.initialFocus?.();
    const target = preferred ?? tabbables()[0] ?? container;
    if (target === container && container.tabIndex < 0 && !container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });
  };

  const onKeyDown = (event: TrapKeyboardEvent) => {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation?.();
      options.onEscape?.();
      return;
    }
    if (event.key !== "Tab") return;
    const items = tabbables();
    if (items.length === 0) {
      // Nothing focusable: keep focus on the dialog itself.
      event.preventDefault();
      container.focus({ preventScroll: true });
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = doc.activeElement as TrapElement | null;
    const inside = current ? container.contains(current) : false;
    if (event.shiftKey) {
      if (!inside || current === first || current === container) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else if (!inside || current === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  const onFocusIn = (event: { target: unknown }) => {
    if (!active) return;
    if (!container.contains(event.target)) focusFirst();
  };

  return {
    get active() {
      return active;
    },
    activate() {
      if (active) return;
      active = true;
      const current = doc.activeElement as TrapElement | null;
      opener = options.returnFocus ?? (current && current !== doc.body ? current : null);

      background = backgroundElements(container, doc.body).map((el) => ({
        el,
        hadInert: el.hasAttribute("inert"),
        ariaHidden: el.getAttribute("aria-hidden"),
      }));
      for (const record of background) {
        if (!record.hadInert) {
          record.el.setAttribute("inert", "");
          record.el.inert = true;
        }
        record.el.setAttribute("aria-hidden", "true");
      }

      doc.addEventListener("keydown", onKeyDown as (event: never) => void, true);
      doc.addEventListener("focusin", onFocusIn as (event: never) => void, true);
      focusFirst();
    },
    deactivate() {
      if (!active) return;
      active = false;
      doc.removeEventListener("keydown", onKeyDown as (event: never) => void, true);
      doc.removeEventListener("focusin", onFocusIn as (event: never) => void, true);

      for (const record of background) {
        if (!record.hadInert) {
          record.el.removeAttribute("inert");
          record.el.inert = false;
        }
        if (record.ariaHidden === null) record.el.removeAttribute("aria-hidden");
        else record.el.setAttribute("aria-hidden", record.ariaHidden);
      }
      background = [];

      const target = opener && opener.isConnected ? opener : (options.fallbackFocus?.() ?? null);
      opener = null;
      target?.focus({ preventScroll: true });
    },
  };
}
