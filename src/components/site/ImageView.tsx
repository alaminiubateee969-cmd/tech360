"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Honest responsive image container:
 *  - Locks layout geometry up-front via `aspectRatio` + `width`/`height` (zero CLS).
 *  - Uses `fetchPriority="high"` + `loading="eager"` for hero/LCP visuals and
 *    `loading="lazy"` + responsive `sizes` for below-the-fold grids.
 *  - Immediately reveals already-cached images on hydration without flashing.
 *  - Renders a stable, accessible fallback if loading fails.
 */
export function ImageView({
  src,
  alt,
  className,
  imgClassName,
  aspect,
  width = 1600,
  height = 1000,
  sizes = "(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw",
  eager = false,
}: {
  src: string | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** CSS aspect ratio, e.g. "16/10" or "4/3". */
  aspect?: string;
  width?: number;
  height?: number;
  sizes?: string;
  eager?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [prevSrc, setPrevSrc] = useState<string | undefined>(src);
  const [status, setStatus] = useState<"loading" | "ok" | "error">(
    src ? "loading" : "error"
  );

  if (src !== prevSrc) {
    setPrevSrc(src);
    setStatus(src ? "loading" : "error");
  }

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0 && status === "loading") {
      setStatus("ok");
    }
  }, [src, status]);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#08192E]",
        aspect ? "" : "h-full",
        className
      )}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      {status === "loading" ? (
        <Skeleton className="absolute inset-0 rounded-none bg-[#0E2747]/60" aria-hidden="true" />
      ) : null}

      {status !== "error" && src ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding={eager ? "sync" : "async"}
          onLoad={() => setStatus("ok")}
          onError={() => setStatus("error")}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
            status === "ok" ? "opacity-100" : "opacity-0",
            imgClassName
          )}
        />
      ) : (
        <div
          role="img"
          aria-label={`${alt} (image unavailable)`}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#063B8F] via-[#074198] to-[#0B1F33] px-4 text-center"
        >
          <ImageOff className="size-6 text-white/50" aria-hidden="true" />
          <span className="text-xs font-medium text-white/60">
            Image unavailable
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Spec-named alias for ImageView (lazy image with skeleton + honest
 * "image unavailable" fallback). Both names export the same component.
 */
export const LazyImage = ImageView;
