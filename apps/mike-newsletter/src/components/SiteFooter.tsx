import { Wordmark } from "@/components/Wordmark";
import { footer, site } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-paper-deep">
      {/* Extra bottom padding on small screens so the sticky subscribe bar,
          which reappears once the closing form scrolls past, never sits on
          top of the footer links. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pt-10 pb-28 sm:px-8 md:flex-row md:items-end md:justify-between lg:pb-10">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink-muted">
            {footer.tagline}
          </p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {footer.links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-ink-muted underline-offset-4 transition hover:text-accent hover:underline"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <p className="text-[0.8125rem] text-ink-subtle">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
