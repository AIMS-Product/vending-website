import { Wordmark } from "@/components/Wordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4 sm:px-8">
        <Wordmark />
        <a
          href="#subscribe"
          className="min-h-10 rounded-md border border-rule-control bg-paper-raised px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
        >
          Subscribe
        </a>
      </div>
    </header>
  );
}
