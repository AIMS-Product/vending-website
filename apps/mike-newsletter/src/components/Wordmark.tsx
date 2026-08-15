import Link from "next/link";
import { site } from "@/lib/content";

/**
 * Typographic mark. Mike's name in the display serif, the publication set
 * underneath as an eyebrow — the same relationship a masthead uses, so the
 * header reads as a paper rather than as a landing page.
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
        className={`eyebrow mt-1 ${dark ? "text-white/55" : "text-ink-subtle"}`}
      >
        {site.publication}
      </span>
    </Link>
  );
}
