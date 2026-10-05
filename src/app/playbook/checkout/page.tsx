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
  return (
    <div className={`${anton.variable} bg-brand-50 min-h-screen`}>
      <StripPiiParams />
      <header className="border-ink border-b-2 bg-white">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 lg:px-10">
          <Wordmark height={36} eager />
          <p className="text-ink/70 flex items-center gap-2 text-xs font-black tracking-[0.1em] uppercase">
            <LockIcon />
            {checkoutPage.eyebrow}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 pt-8 pb-14 lg:px-10 lg:pt-12">
        <h1 className="v2-display text-ink text-[clamp(2rem,3.4vw,3rem)] leading-[1.02] uppercase">
          {checkoutPage.title}
        </h1>
        <p className="text-ink/70 mt-2">{checkoutPage.subtitle}</p>

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-8">
          <section aria-label="Payment">
            <div className="border-ink shadow-card rounded-card overflow-hidden border-2 bg-white">
              <PlaybookCheckoutFrame src={embedCheckoutSrc(params)} />
            </div>
            <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              {checkoutPage.trust.map((line) => (
                <li key={line} className="flex items-start gap-2 leading-snug">
                  <CheckIcon className="text-brand-600 mt-0.5 size-4 shrink-0" />
                  <span className="text-ink/80 font-semibold">{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-ink/60 mt-4 text-xs">
              {checkoutPage.fallback}{" "}
              <a
                href={fallbackCheckoutHref(params)}
                className="text-brand-700 font-bold underline underline-offset-2"
              >
                {checkoutPage.fallbackLink}
              </a>
            </p>
          </section>

          <OrderSummary />

          <section className="lg:col-start-1">
            <p className={EYEBROW}>{checkoutPage.proofTitle}</p>
            <ul className="mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-1">
              {opportunityQuotes.map((q) => (
                <li
                  key={q.name}
                  className="border-ink/15 rounded-card flex flex-col justify-between border-2 bg-white p-4"
                >
                  <p className="text-ink leading-snug font-bold">{q.quote}</p>
                  <p className="text-eyebrow mt-3 text-xs font-black tracking-[0.1em] uppercase">
                    {q.name}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="mx-auto mt-12 max-w-3xl text-center text-xs leading-relaxed text-slate-600">
          {DISCLAIMER}
        </p>
      </main>
    </div>
  );
}

function OrderSummary() {
  const included = [
    ...includedBonuses.items.map((b) => b.title),
    ...moreBonuses.items.slice(0, 4).map((b) => b.title),
  ];
  return (
    <aside
      aria-label={checkoutPage.summaryTitle}
      className="border-ink rounded-card overflow-hidden border-2 bg-white lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1"
    >
      <div className="v2-dots border-ink border-b-2 px-5 pt-4 pb-2">
        <Image
          src={images.productTrimmed.src}
          alt={images.productTrimmed.alt}
          width={images.productTrimmed.width}
          height={images.productTrimmed.height}
          sizes="(min-width:1024px) 420px, 100vw"
          priority
          className="mx-auto h-auto w-full max-w-[420px]"
        />
      </div>
      <div className="p-5">
        <p className={EYEBROW}>{checkoutPage.summaryTitle}</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <p className="text-ink text-lg leading-tight font-black">
              {checkoutPage.itemName}
            </p>
            <p className="text-ink/65 mt-1 text-sm">{checkoutPage.itemNote}</p>
          </div>
          <p className="text-ink/45 shrink-0 pt-0.5 text-sm font-black line-through">
            {PRICE.anchor}
          </p>
        </div>
        <p className="text-ink/60 mt-4 text-xs font-black tracking-[0.1em] uppercase">
          {checkoutPage.includedTitle}
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {included.map((item) => (
            <li key={item} className="flex gap-2 leading-snug">
              <CheckIcon className="text-brand-600 mt-0.5 size-4 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="border-ink mt-5 flex items-baseline justify-between border-t-2 pt-4">
          <span className="text-ink font-black">{checkoutPage.totalLabel}</span>
          <span className="flex items-baseline gap-2">
            <span className="text-brand-700 text-xs font-black uppercase">
              {PRICE.save}
            </span>
            <span className="v2-display text-ink text-4xl leading-none">
              {PRICE.today}
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="currentColor">
      <path d="M10 2a4 4 0 00-4 4v2H5a1 1 0 00-1 1v8a1 1 0 001 1h10a1 1 0 001-1V9a1 1 0 00-1-1h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z" />
    </svg>
  );
}
