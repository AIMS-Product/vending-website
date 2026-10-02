import { siteName } from "@/lib/site";

/**
 * Footer copyright line. The year is read at render time; a page cached across
 * New Year can differ from the browser's clock for a moment, so the year span
 * opts out of the hydration text check instead of logging a mismatch.
 */
export function CopyrightLine({ className }: { className?: string }) {
  return (
    <p className={className}>
      &copy; <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
      {siteName}. All rights reserved.
    </p>
  );
}
