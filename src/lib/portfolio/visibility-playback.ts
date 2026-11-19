/**
 * Visibility-aware playback for silent portfolio videos.
 *
 * Rules (documented in docs/VISUAL_ASSET_MANIFEST.md §4.3):
 *  - Playback intent is one of:
 *      "auto"        nobody has touched the control; plays only while
 *                    autoplay is allowed (prop set AND no reduced-motion);
 *      "user-play"   the visitor pressed Play;
 *      "user-pause"  the visitor pressed Pause — NEVER overridden.
 *  - The video plays only while it is sufficiently on screen and the tab is
 *    visible. Scrolling it away (or hiding the tab) pauses it; scrolling back
 *    resumes it only if the intent allows (auto + autoplay permitted, or an
 *    explicit user-play). A manually paused video is never restarted.
 *  - A pause the controller did not cause (e.g. OS media keys) counts as a
 *    user pause.
 *  - One IntersectionObserver is shared by every registered video (per
 *    threshold) and disconnected when the last one unregisters.
 */

export type PlaybackIntent = "auto" | "user-play" | "user-pause";

export interface PlayableMedia {
  readonly paused: boolean;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: "play" | "pause", listener: () => void): void;
  removeEventListener(type: "play" | "pause", listener: () => void): void;
}

export interface VisibilityDocument {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

/** Subscribe `element` to visibility changes; returns an unsubscribe function. */
export type ObserveVisibility = (element: unknown, onChange: (visible: boolean) => void) => () => void;

export interface VisibilityPlaybackOptions {
  media: PlayableMedia;
  element: unknown;
  autoplayAllowed: boolean;
  observe: ObserveVisibility;
  doc?: VisibilityDocument | null;
}

export interface VisibilityPlayback {
  /** Play/pause button handler — records the visitor's intent. */
  toggle(): void;
  setAutoplayAllowed(allowed: boolean): void;
  destroy(): void;
  readonly intent: PlaybackIntent;
  readonly visible: boolean;
}

export function createVisibilityPlayback(options: VisibilityPlaybackOptions): VisibilityPlayback {
  const { media, element, observe } = options;
  const doc = options.doc ?? null;
  let autoplayAllowed = options.autoplayAllowed;
  let intent: PlaybackIntent = "auto";
  let visible = false;
  let destroyed = false;
  /** Pause calls issued by the controller, so their `pause` events are not read as user intent. */
  let expectedPauses = 0;

  const tabVisible = () => !(doc && doc.hidden);
  const wantsPlayback = () => intent === "user-play" || (intent === "auto" && autoplayAllowed);

  const play = () => {
    try {
      const result = media.play();
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => {
          /* Autoplay can be refused by the browser; the poster stays visible. */
        });
      }
    } catch {
      /* ignore */
    }
  };

  const pauseBySystem = () => {
    if (media.paused) return;
    expectedPauses += 1;
    media.pause();
  };

  const reconcile = () => {
    if (destroyed) return;
    const shouldPlay = visible && tabVisible() && wantsPlayback();
    if (shouldPlay && media.paused) play();
    else if (!shouldPlay && !media.paused) pauseBySystem();
  };

  const onPause = () => {
    if (expectedPauses > 0) {
      expectedPauses -= 1;
      return;
    }
    // Not caused by us (media keys, browser UI): respect it as a manual pause.
    if (!destroyed) intent = "user-pause";
  };

  const onVisibilityChange = () => reconcile();

  media.addEventListener("pause", onPause);
  doc?.addEventListener("visibilitychange", onVisibilityChange);
  const unobserve = observe(element, (isVisible) => {
    visible = isVisible;
    reconcile();
  });

  return {
    get intent() {
      return intent;
    },
    get visible() {
      return visible;
    },
    toggle() {
      if (destroyed) return;
      if (media.paused) {
        intent = "user-play";
        play();
      } else {
        intent = "user-pause";
        expectedPauses += 1; // our own call — onPause must not double-handle it
        media.pause();
      }
    },
    setAutoplayAllowed(allowed: boolean) {
      autoplayAllowed = allowed;
      reconcile();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unobserve();
      media.removeEventListener("pause", onPause);
      doc?.removeEventListener("visibilitychange", onVisibilityChange);
      if (!media.paused) {
        expectedPauses += 1;
        media.pause();
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Shared IntersectionObserver registry                               */
/* ------------------------------------------------------------------ */

export interface IntersectionEntryLike {
  target: unknown;
  isIntersecting: boolean;
  intersectionRatio: number;
}

export interface IntersectionObserverLike {
  observe(target: unknown): void;
  unobserve(target: unknown): void;
  disconnect(): void;
}

export type IntersectionObserverFactory = (
  callback: (entries: IntersectionEntryLike[]) => void,
  options: { threshold: number[] },
) => IntersectionObserverLike;

/** Ratio of the video that must be visible for it to count as "on screen". */
export const VISIBLE_RATIO = 0.35;

/**
 * One observer for every subscribed element. `factory` defaults to the
 * browser IntersectionObserver; when it is unavailable, elements are treated
 * as visible (playback rules still apply).
 */
export function createSharedVisibilityObserver(
  factory?: IntersectionObserverFactory | null,
  ratio = VISIBLE_RATIO,
) {
  const listeners = new Map<unknown, (visible: boolean) => void>();
  let observer: IntersectionObserverLike | null = null;

  const resolvedFactory: IntersectionObserverFactory | null =
    factory ??
    (typeof IntersectionObserver === "function"
      ? (cb, opts) => new IntersectionObserver(cb as IntersectionObserverCallback, opts) as unknown as IntersectionObserverLike
      : null);

  const observe: ObserveVisibility = (element, onChange) => {
    if (!resolvedFactory) {
      onChange(true);
      return () => undefined;
    }
    if (!observer) {
      observer = resolvedFactory(
        (entries) => {
          for (const entry of entries) {
            listeners.get(entry.target)?.(entry.isIntersecting && entry.intersectionRatio >= ratio);
          }
        },
        { threshold: [0, ratio] },
      );
    }
    listeners.set(element, onChange);
    observer.observe(element);
    return () => {
      if (!listeners.has(element)) return;
      listeners.delete(element);
      observer?.unobserve(element);
      if (listeners.size === 0) {
        observer?.disconnect();
        observer = null;
      }
    };
  };

  return {
    observe,
    /** For tests and diagnostics. */
    get size() {
      return listeners.size;
    },
    get connected() {
      return observer !== null;
    },
  };
}

let sharedRegistry: ReturnType<typeof createSharedVisibilityObserver> | null = null;

/** Process-wide shared observer used by MotionPreview. */
export function sharedVisibilityObserver() {
  sharedRegistry ??= createSharedVisibilityObserver();
  return sharedRegistry;
}
