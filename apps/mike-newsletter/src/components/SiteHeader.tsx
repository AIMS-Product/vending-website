import { Wordmark } from "@/components/Wordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-3.5 sm:px-8">
        <Wordmark />
        {/* Phone-only omission, not an oversight: the hero form sits above the
            fold and the sticky bar covers the rest of the scroll, so this
            button would be a third ask competing for 312px of masthead. */}
        <a
          href="#subscribe"
          className="hidden min-h-11 items-center rounded-md border border-rule-control bg-paper-raised px-4 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent sm:inline-flex"
        >
          Subscribe
        </a>
      </div>
    </header>
  );
}
