"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type ImageWithFallbackProps = Omit<ImageProps, "onError" | "src"> & {
  src: string;
  /** Extra classes applied to the branded fallback placeholder. */
  fallbackClassName?: string;
  /**
   * Forces the fallback to render. Test-only escape hatch so the error
   * branch can be exercised without a real network failure.
   */
  forceFallback?: boolean;
};

/**
 * `next/image` wrapper that swaps in a branded placeholder when the image
 * fails to load (e.g. a transient upstream 5xx from the remote CDN) instead
 * of leaving a broken-image glyph and raw alt text on screen.
 */
export function ImageWithFallback({
  fallbackClassName,
  forceFallback = false,
  alt,
  className,
  ...imageProps
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(forceFallback);

  if (hasError) {
    return <ImageFallback className={fallbackClassName} label={alt} />;
  }

  return (
    <Image
      {...imageProps}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

type ImageFallbackProps = {
  className?: string;
  label?: string;
};

/**
 * Branded placeholder shown in place of a failed image. Matches the card
 * styling (brand blue block + mark) rather than surfacing a broken-image
 * icon. Exported so the error state can be unit-tested directly.
 */
export function ImageFallback({ className, label }: ImageFallbackProps) {
  return (
    <div
      role="img"
      aria-label={label}
      data-image-fallback="true"
      className={[
        "flex h-full w-full items-center justify-center bg-[#55b8e8]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-10 w-10 text-[#0b3a52]"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
        <path d="m5 17 4.5-4.5L13 16l2.5-2.5L19 17" />
      </svg>
    </div>
  );
}
