import type { Metadata } from "next";
import Image from "next/image";
import "../../home-v2.css";
import { anton } from "../../fonts";
import { Wordmark } from "@/components/site/Wordmark";
import { CheckIcon, EYEBROW } from "@/components/sections/playbook/PlaybookCta";
import { PlaybookCheckoutFrame } from "@/components/sections/playbook/PlaybookCheckoutFrame";
import { StripPiiParams } from "@/components/sections/masterclass/StripPiiParams";
import {
  DISCLAIMER,
  PRICE,
  checkoutPage,
  embedCheckoutSrc,
  fallbackCheckoutHref,
  images,
  includedBonuses,
  moreBonuses,
  opportunityQuotes,
} from "@/lib/content/playbook";

export const metadata: Metadata = {
  title: "Checkout · Mike Hoffmann's Vending Playbook",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PlaybookCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const included = [
    ...includedBonuses.items.map((b) => b.title),
    ...moreBonuses.items.slice(0, 4).map((b) => b.title),
  ];
  return (
    <div className={`${anton.variable} bg-brand-50 min-h-screen`}>
      <StripPiiParams />
      <header className="border-ink border-b-2 bg-white">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-4 lg:px-10">
          <Wordmark height={36} eager />
          <p className="text-ink/70 flex items-center gap-2 text-xs font-black tracking-[0.1em] uppercase">
            <LockIcon />
            {checkoutPage.eyebrow}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1240px] items-start gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:px-10 lg:py-12">
        <section className="lg:sticky lg:top-8">
          <p className={EYEBROW}>{checkoutPage.summaryTitle}</p>
          <h1 className="v2-display text-ink mt-3 text-[clamp(2.2rem,3.6vw,3.25rem)] leading-[1.02] uppercase">
            {checkoutPage.title}
          </h1>
          <div className="border-ink shadow-card rounded-card mt-6 overflow-hidden border-2 bg-white">
            <div className="v2-dots border-ink border-b-2 px-4 pt-4 pb-2">
              <Image
                src={images.productTrimmed.src}
                alt={images.productTrimmed.alt}
                width={images.productTrimmed.width}
                height={images.productTrimmed.height}
                sizes="(min-width:1024px) 520px, 100vw"
                priority
                className="mx-auto h-auto w-full max-w-[520px]"
              />
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-ink font-black">{checkoutPage.itemName}</p>
                  <p className="text-ink/70 mt-1 text-sm">
                    {checkoutPage.itemNote}
                  </p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="text-ink/50 block text-sm font-black line-through">
                    {PRICE.anchor}
                  </span>
                  <span className="v2-display text-brand-700 text-4xl leading-none">
                    {PRICE.today}
                  </span>
                </p>
              </div>
              <ul className="border-ink/15 mt-5 grid gap-2 border-t-2 pt-5 text-sm sm:grid-cols-2">
                {included.map((item) => (
                  <li key={item} className="flex gap-2 leading-snug">
                    <CheckIcon className="text-brand-600 mt-0.5 size-4 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ul className="mt-6 space-y-3 max-lg:hidden">
            {opportunityQuotes.slice(0, 2).map((q) => (
              <li
                key={q.name}
                className="border-ink/15 rounded-card border-2 bg-white p-4"
              >
                <p className="text-ink leading-snug font-bold">{q.quote}</p>
                <p className="text-eyebrow mt-1 text-xs font-black tracking-[0.1em] uppercase">
                  {q.name}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-ink shadow-card rounded-card -order-1 overflow-hidden border-2 bg-white lg:order-none">
          <PlaybookCheckoutFrame src={embedCheckoutSrc(params)} />
          <p className="border-ink/10 text-ink/70 border-t px-5 py-3 text-center text-xs">
            {checkoutPage.fallback}{" "}
            <a
              href={fallbackCheckoutHref(params)}
              className="text-brand-700 font-bold underline underline-offset-2"
            >
              {checkoutPage.fallbackLink}
            </a>
          </p>
        </section>
      </main>
      <p className="mx-auto max-w-3xl px-5 pb-10 text-center text-xs leading-relaxed text-slate-600">
        {DISCLAIMER}
      </p>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="currentColor">
      <path d="M10 2a4 4 0 00-4 4v2H5a1 1 0 00-1 1v8a1 1 0 001 1h10a1 1 0 001-1V9a1 1 0 00-1-1h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z" />
    </svg>
  );
}
