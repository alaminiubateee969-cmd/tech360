"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Honest lazy image: skeleton while loading, branded gradient fallback with
 * an explicit "image unavailable" state when loading fails. Remote images
 * are never assumed to exist.
 */
export function ImageView({
  src,
  alt,
  className,
  imgClassName,
  aspect,
  eager = false,
}: {
  src: string | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** CSS aspect ratio, e.g. "16/9". */
  aspect?: string;
  eager?: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">(
    src ? "loading" : "error"
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#F4FAFF]",
        aspect ? "" : "h-full",
        className
      )}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      {status === "loading" ? (
        <Skeleton className="absolute inset-0 rounded-none" aria-hidden="true" />
      ) : null}

      {status !== "error" && src ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setStatus("ok")}
          onError={() => setStatus("error")}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
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
