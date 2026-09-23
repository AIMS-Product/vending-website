import type { ReactNode } from "react";
import Link from "next/link";
import { ApplyDisclaimer } from "@/components/sections/apply/ApplyDisclaimer";
import { Wordmark } from "@/components/site/Wordmark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

type SupportPageCta = {
  label: string;
  href: string;
};

type SupportPageProps = {
  eyebrow: string;
  title: string;
  body?: string;
  items?: string[];
  /** Inline widget (e.g. a Calendly scheduler) rendered in place of body copy + CTA. */
  embed?: ReactNode;
  cta?: SupportPageCta;
  /** Lead-in text shown just before the secondary CTA link. */
  secondaryNote?: string;
  secondaryCta?: SupportPageCta;
  /** Optional hidden debug value (e.g. a qualification score) surfaced only in markup for QA. */
  debugValue?: string;
};

// The post-conversion shell (/thank-you in all four fit states,
// /thank-you-for-applying). These routes carry no site header or footer
// (isFunnelChromePath), so the shell brings its own: the wordmark alone on
// top, not a link, since the lead's next step is on this page or in their
// inbox; the funnel's disclaimer band at the bottom.
export function SupportPage({
  eyebrow,
  title,
  body,
  items,
  embed,
  cta,
  secondaryNote,
  secondaryCta,
  debugValue,
}: SupportPageProps) {
  return (
    <>
      <header className="border-ink border-b-2 bg-white">
        <Container className="flex h-16 items-center justify-center lg:h-20">
          <Wordmark height={36} eager />
        </Container>
      </header>

      <section className="bg-brand-50 py-14 lg:py-20">
        <Container width="article" className="text-center">
          {/* The fit label is state, so it keeps the pill (DESIGN.md). */}
          <p className="border-ink text-eyebrow inline-flex rounded-full border-2 bg-white px-4 py-1.5 text-xs font-black tracking-[0.14em] uppercase">
            {eyebrow}
          </p>
          <h1 className="text-ink mx-auto mt-6 max-w-[18ch] text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05] font-black uppercase">
            {title}
          </h1>
          {body && (
            <p className="mx-auto mt-5 max-w-[46ch] text-lg leading-relaxed font-semibold text-slate-700">
              {body}
            </p>
          )}
          {embed && <div className="mt-10 text-left">{embed}</div>}
          {items && items.length > 0 && (
            <Card className="max-w-narrow mx-auto mt-10 text-left">
              <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
                Next steps
              </p>
              <ol className="mt-4 grid gap-4">
                {items.map((item, index) => (
                  <li key={item} className="flex items-start gap-4">
                    <span
                      aria-hidden
                      className="border-ink bg-brand-600 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black text-white"
                    >
                      {index + 1}
                    </span>
                    <span className="pt-1 text-base leading-relaxed font-semibold text-slate-700">
                      {item}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {(cta || secondaryCta) && (
            <div className="mt-10 flex flex-col items-center gap-4">
              {cta && (
                <Button href={cta.href} variant="primary" size="lg" showArrow>
                  {cta.label}
                </Button>
              )}
              {secondaryCta && (
                <p className="text-base font-semibold text-slate-600">
                  {secondaryNote ? `${secondaryNote} ` : null}
                  <Link
                    href={secondaryCta.href}
                    className="text-eyebrow hover:text-ink font-black underline underline-offset-2"
                  >
                    {secondaryCta.label}
                  </Link>
                </p>
              )}
            </div>
          )}
          {debugValue !== undefined && (
            <span className="sr-only" data-testid="support-page-debug-value">
              {debugValue}
            </span>
          )}
        </Container>
      </section>

      <ApplyDisclaimer />
    </>
  );
}
