"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  Info,
  Link2,
  Pause,
  Play,
  Printer,
  Share2,
  X,
} from "lucide-react";

import {
  PROVENANCE,
  type MediaProvenance,
  type PortfolioImage,
  type PortfolioVideo,
} from "@/data/portfolio";
import { cn } from "@/lib/utils";
import { createFocusTrap, type TrapElement } from "@/lib/portfolio/focus-trap";
import {
  createVisibilityPlayback,
  sharedVisibilityObserver,
  type VisibilityPlayback,
} from "@/lib/portfolio/visibility-playback";

/* ------------------------------------------------------------------ */
/* Reduced-motion preference                                           */
/* ------------------------------------------------------------------ */

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** `true` on the server and until hydration, so nothing autoplays unexpectedly. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Provenance badge                                                    */
/* ------------------------------------------------------------------ */

export function ProvenanceBadge({
  provenance,
  tone = "dark",
  className,
}: {
  provenance: MediaProvenance;
  tone?: "dark" | "light";
  className?: string;
}) {
  const info = PROVENANCE[provenance];
  return (
    <span
      title={info.description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur",
        tone === "dark"
          ? "border border-white/20 bg-[#061528]/80 text-[#CFE9F7]"
          : "border border-[#E2E8F0] bg-white text-[#526173]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          provenance === "client-evidence" ? "bg-[#18B83A]" : "bg-[#F5B301]",
        )}
      />
      {info.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Motion preview player                                               */
/* ------------------------------------------------------------------ */

/**
 * Silent concept video with an explicit play/pause control, a duration chip,
 * a provenance label and a visible text alternative. Autoplay (muted, looped)
 * is only used when `autoPlay` is set AND the visitor has not asked for
 * reduced motion; otherwise the poster is shown until the visitor presses play.
 *
 * Autoplaying previews are visibility-aware (src/lib/portfolio/visibility-playback.ts):
 * they pause when scrolled off screen or when the tab is hidden, and resume
 * only when visible again AND autoplay is still allowed. A manual pause is
 * never overridden. All autoplaying previews share one IntersectionObserver;
 * click-to-play previews register no observer at all.
 */
export function MotionPreview({
  video,
  autoPlay = false,
  className,
  showDescription = true,
  rounded = true,
}: {
  video: PortfolioVideo;
  autoPlay?: boolean;
  className?: string;
  showDescription?: boolean;
  rounded?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const shouldAutoPlay = autoPlay && !reduced;
  const controllerRef = useRef<VisibilityPlayback | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // Autoplay previews: one visibility controller per player, one shared observer.
  useEffect(() => {
    const el = ref.current;
    if (!el || !autoPlay) return;
    const controller = createVisibilityPlayback({
      media: el,
      element: el,
      autoplayAllowed: !reducedRef.current,
      observe: sharedVisibilityObserver().observe,
      doc: document,
    });
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [autoPlay, video.src]);

  // Reduced-motion can change at runtime (and flips from the SSR default after hydration).
  useEffect(() => {
    controllerRef.current?.setAutoplayAllowed(!reduced);
  }, [reduced]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (controllerRef.current) {
      controllerRef.current.toggle();
      return;
    }
    if (el.paused) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, []);

  const descriptionId = `video-desc-${video.src.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <figure className={cn("w-full", className)}>
      <div
        className={cn(
          "group/video relative overflow-hidden bg-[#061528]",
          rounded && "rounded-2xl",
        )}
        style={{ aspectRatio: `${video.width}/${video.height}` }}
      >
        <video
          ref={ref}
          src={video.src}
          poster={video.poster}
          width={video.width}
          height={video.height}
          muted
          loop
          playsInline
          preload={shouldAutoPlay ? "auto" : "none"}
          aria-label={video.title}
          aria-describedby={showDescription ? descriptionId : undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={toggle}
          className="size-full cursor-pointer object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#040E1C]/80 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? `Pause ${video.title}` : `Play ${video.title}`}
            aria-pressed={playing}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-semibold text-[#0B1F33] shadow-lg outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#061528]"
          >
            {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4 fill-current" aria-hidden="true" />}
            {playing ? "Pause" : "Play preview"}
            <span className="rounded-full bg-[#0B1F33]/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
              {formatDuration(video.durationSeconds)}
            </span>
          </button>
          <ProvenanceBadge provenance={video.provenance} />
        </div>
      </div>
      {showDescription ? (
        <figcaption id={descriptionId} className="mt-3 text-xs leading-relaxed text-[#64748B]">
          <span className="font-semibold text-[#334155]">Video description: </span>
          {video.description}
        </figcaption>
      ) : null}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery with lightbox                                               */
/* ------------------------------------------------------------------ */

type GalleryItem = { type: "image"; image: PortfolioImage } | { type: "video"; video: PortfolioVideo };

export function MediaGallery({
  images,
  video,
  title,
}: {
  images: PortfolioImage[];
  video?: PortfolioVideo;
  title: string;
}) {
  const items: GalleryItem[] = [
    ...(video ? [{ type: "video" as const, video }] : []),
    ...images.map((image) => ({ type: "image" as const, image })),
  ];
  const [open, setOpen] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={index} className={cn(index === 0 && items.length > 2 && "sm:col-span-2")}>
            {item.type === "video" ? (
              <MotionPreview video={item.video} />
            ) : (
              <figure>
                <button
                  type="button"
                  onClick={(event) => {
                    triggerRef.current = event.currentTarget;
                    setOpen(index);
                  }}
                  aria-label={`Enlarge image: ${item.image.alt}`}
                  className="group relative block w-full overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#061528] outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
                  style={{ aspectRatio: `${item.image.width}/${item.image.height}` }}
                >
                  <img
                    src={item.image.src}
                    alt={item.image.alt}
                    width={item.image.width}
                    height={item.image.height}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
                  />
                  <span className="absolute left-3 top-3">
                    <ProvenanceBadge provenance={item.image.provenance} />
                  </span>
                  <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-[#061528]/80 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Expand className="size-4" aria-hidden="true" />
                  </span>
                </button>
                <figcaption className="mt-2 text-xs leading-relaxed text-[#64748B]">{item.image.caption}</figcaption>
              </figure>
            )}
          </li>
        ))}
      </ul>

      {open !== null ? (
        <Lightbox
          title={title}
          images={images}
          index={open - (video ? 1 : 0)}
          onIndex={(next) => setOpen(next + (video ? 1 : 0))}
          returnFocus={triggerRef.current}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Accessible image viewer (modal dialog).
 *
 * - Rendered in a portal on <body>; titled via aria-labelledby, described by
 *   the caption, aria-modal.
 * - Focus moves to Close on open; Tab / Shift+Tab wrap inside the dialog;
 *   Escape closes; arrow keys page; buttons are native (Enter/Space).
 * - Everything outside the dialog is `inert` + aria-hidden while open, and
 *   restored on close or unmount; focus returns to the thumbnail that opened
 *   it (or to the main landmark if that element is gone).
 * Focus logic: src/lib/portfolio/focus-trap.ts (unit-tested).
 */
function Lightbox({
  title,
  images,
  index,
  onIndex,
  onClose,
  returnFocus,
}: {
  title: string;
  images: PortfolioImage[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const captionId = useId();
  const image = images[index];
  const many = images.length > 1;

  // Latest callbacks for the mount-only effect below (no re-run per index).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const returnFocusRef = useRef(returnFocus ?? null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trap = createFocusTrap(dialog as unknown as TrapElement, {
      initialFocus: () => closeRef.current as unknown as TrapElement | null,
      returnFocus: (returnFocusRef.current as unknown as TrapElement | null) ?? undefined,
      fallbackFocus: () => document.getElementById("main-content") as unknown as TrapElement | null,
      onEscape: () => onCloseRef.current(),
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    trap.activate();
    return () => {
      trap.deactivate();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const go = (delta: number) => onIndex((index + delta + images.length) % images.length);

  if (!image || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={captionId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (!many) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(-1);
        }
      }}
      className="fixed inset-0 z-[95] flex flex-col bg-[#020812]/95 p-3 outline-none backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 text-white" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId} className="truncate text-sm font-semibold">
          {title} <span className="font-normal text-white/60">· image {index + 1} of {images.length}</span>
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020812]"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Image {index + 1} of {images.length}: {image.alt}
      </p>
      <div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center">
        <img
          src={image.src}
          alt={image.alt}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        />
        {many ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                go(-1);
              }}
              aria-label={`Previous image (${((index - 1 + images.length) % images.length) + 1} of ${images.length})`}
              className="absolute left-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#061528]/80 text-white outline-none hover:bg-[#061528] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020812]"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                go(1);
              }}
              aria-label={`Next image (${((index + 1) % images.length) + 1} of ${images.length})`}
              className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#061528]/80 text-white outline-none hover:bg-[#061528] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020812]"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
      <div
        id={captionId}
        className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-center text-xs text-white/75"
        onClick={(event) => event.stopPropagation()}
      >
        <ProvenanceBadge provenance={image.provenance} />
        <span>{image.caption}</span>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Share bar                                                           */
/* ------------------------------------------------------------------ */

export function ShareBar({ title, path, tone = "dark" }: { title: string; path: string; tone?: "dark" | "light" }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // Feature detection must run after hydration to keep server and client markup identical.
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const url = () => `${window.location.origin}${path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy this link", url());
    }
  };

  const base =
    tone === "dark"
      ? "border-white/20 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/70"
      : "border-[#E2E8F0] bg-white text-[#063B8F] hover:border-[#009FE3] focus-visible:ring-[#009FE3]";
  const button = cn(
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold outline-none transition focus-visible:ring-2",
    base,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden" aria-label="Share this page" role="group">
      <span className={cn("mr-1 text-[11px] font-semibold uppercase tracking-[0.16em]", tone === "dark" ? "text-white/60" : "text-[#8A9AAB]")}>
        Share
      </span>
      <button type="button" onClick={copy} className={button} aria-live="polite">
        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Link2 className="size-3.5" aria-hidden="true" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
      {canShare ? (
        <button
          type="button"
          onClick={() => navigator.share({ title, url: url() }).catch(() => null)}
          className={button}
        >
          <Share2 className="size-3.5" aria-hidden="true" />
          Share…
        </button>
      ) : null}
      <a
        className={button}
        target="_blank"
        rel="noopener noreferrer"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://bdtech360.com${path}`)}`}
      >
        LinkedIn<span className="sr-only"> (opens in a new tab)</span>
      </a>
      <a
        className={button}
        target="_blank"
        rel="noopener noreferrer"
        href={`https://wa.me/?text=${encodeURIComponent(`${title} — https://bdtech360.com${path}`)}`}
      >
        WhatsApp<span className="sr-only"> (opens in a new tab)</span>
      </a>
      <button type="button" onClick={() => window.print()} className={button}>
        <Printer className="size-3.5" aria-hidden="true" />
        Print
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Evidence legend                                                     */
/* ------------------------------------------------------------------ */

export function EvidenceLegend({ className }: { className?: string }) {
  const order: MediaProvenance[] = ["concept-artwork", "architecture-diagram", "motion-preview", "client-evidence"];
  return (
    <div className={cn("rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6", className)}>
      <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1F33]">
        <Info className="size-4 text-[#009FE3]" aria-hidden="true" />
        How to read the media in this portfolio
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {order.map((key) => (
          <div key={key}>
            <dt>
              <ProvenanceBadge provenance={key} tone="light" />
            </dt>
            <dd className="mt-2 text-xs leading-relaxed text-[#526173]">
              {PROVENANCE[key].description}
              {key === "client-evidence" ? (
                <span className="mt-1 block font-semibold text-[#0B1F33]">
                  None published yet — confidential deployments can be walked through privately under NDA.
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
