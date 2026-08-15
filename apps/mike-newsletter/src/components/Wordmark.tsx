import Link from "next/link";
import { site } from "@/lib/content";

/**
 * Typographic mark. Mike's name in the display serif, the publication set
 * underneath as an eyebrow — the same relationship a masthead uses, so the
 * header reads as a paper rather than as a landing page.
 *
 * The publication line uses its own utilities instead of the shared `.eyebrow`
 * class: `.eyebrow` is defined after Tailwind's utilities and would win the
 * cascade against any responsive size override written here.
 */
export function Wordmark({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <Link href="/" className="group inline-flex flex-col leading-none">
      <span
        className={`font-display text-lg tracking-tight ${
          dark ? "text-ink-inverse" : "text-ink"
        }`}
      >
        {site.name}
      </span>
      <span
        className={`mt-1 text-[0.625rem] font-semibold tracking-[0.12em] whitespace-nowrap uppercase sm:text-[0.6875rem] sm:tracking-[0.16em] ${
          dark ? "text-white/55" : "text-ink-subtle"
        }`}
      >
        {site.publication}
      </span>
    </Link>
  );
}
