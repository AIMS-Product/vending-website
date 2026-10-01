import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/site/Wordmark";
import { Highlight } from "@/components/ui/Highlight";
import {
  BUY_CTA,
  DISCLAIMER,
  PRICE,
  faq,
  finalOffer,
  host,
  images,
} from "@/lib/content/playbook";
import { EYEBROW, H2, PlaybookCta } from "./PlaybookCta";

interface PlaybookCloseProps {
  checkoutHref: string;
}

export function PlaybookHost({ checkoutHref }: PlaybookCloseProps) {
  const [before, after] = host.title.split(host.highlight);
  return (
    <section className="bg-brand-50 border-ink border-b-2 py-16 lg:py-24">
      <div className="mx-auto grid max-w-[1180px] items-start gap-10 px-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16 lg:px-10">
        {/* Phones: the story leads and the photo follows it. */}
        <div className="order-last lg:sticky lg:top-[120px] lg:order-none lg:self-start">
          <Image
            src={images.mike.src}
            alt={images.mike.alt}
            width={images.mike.width}
            height={images.mike.height}
            sizes="(min-width: 1024px) 420px, 90vw"
            className="border-ink shadow-card rounded-card mx-auto aspect-[4/3] h-auto w-full max-w-[420px] border-2 object-cover object-[50%_22%] lg:aspect-auto"
          />
        </div>
        <div>
          <p className={EYEBROW}>{host.eyebrow}</p>
          <h2
            data-reveal
            className="v2-display text-ink mt-3 text-[1.625rem] leading-[1.15] text-balance uppercase lg:max-w-[28ch] lg:text-[2.75rem]"
          >
            {before}
            <Highlight>{host.highlight}</Highlight>
            {after}
          </h2>
          <div className="mt-8 max-w-[60ch] space-y-5 text-[1.05rem] leading-relaxed">
            {host.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
          <PlaybookCta href={checkoutHref} label={BUY_CTA} className="mt-8" />
        </div>
      </div>
    </section>
  );
}

export function PlaybookFaq() {
  return (
    <section className="border-ink border-b-2 bg-white py-16 lg:py-24">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-10">
        <h2 data-reveal className={`${H2} self-start lg:self-center`}>
          {faq.title}
        </h2>
        <div className="space-y-3">
          {faq.items.map((item) => (
            <details
              key={item.q}
              className="group border-ink rounded-card open:bg-tint border-2 bg-white"
            >
              <summary className="text-ink flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-[1.05rem] font-black focus-visible:outline-offset-[-3px] [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="border-ink grid size-8 shrink-0 place-items-center rounded-full border-2"
                >
                  {/* lucide ChevronDown, matching the bonus rows. */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <p className="px-5 pt-1 pb-5 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlaybookFinalOffer({ checkoutHref }: PlaybookCloseProps) {
  return (
    <section className="bg-brand-50 py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <div className="border-ink shadow-card rounded-card overflow-hidden border-2 bg-white">
          <div className="bg-tint border-ink v2-dots flex justify-center overflow-hidden border-b-2 px-3 pt-5 pb-4 sm:px-6 sm:pt-8 sm:pb-6 lg:px-16 lg:pt-12 lg:pb-8">
            <Image
              src={images.productTrimmed.src}
              alt={images.productTrimmed.alt}
              width={images.productTrimmed.width}
              height={images.productTrimmed.height}
              sizes="(min-width:1024px) 760px, 100vw"
              className="h-auto w-full max-w-[760px] object-contain"
            />
          </div>
          <div className="mx-auto max-w-[640px] p-6 text-center sm:p-10">
            <p className={EYEBROW}>{finalOffer.badge}</p>
            <h2 className="v2-display text-ink mt-3 text-[clamp(2.2rem,4vw,3.25rem)] leading-[1.02] uppercase">
              {finalOffer.title}
            </h2>
            <p className="mt-3 text-sm font-bold">{finalOffer.proof}</p>
            <p className="text-eyebrow mt-5 text-sm font-black uppercase">
              {finalOffer.urgency}
            </p>
            <p className="mt-2 flex items-baseline justify-center gap-3">
              <span className="text-ink/55 text-2xl font-black line-through">
                {PRICE.anchor}
              </span>
              <span className="v2-display text-brand-700 text-6xl leading-none">
                {finalOffer.price}
              </span>
            </p>
            <p className="mt-2 text-sm font-bold">{PRICE.save}</p>
            <p className="mx-auto mt-5 max-w-sm leading-snug">
              {finalOffer.line}
            </p>
            <PlaybookCta
              href={checkoutHref}
              label={finalOffer.cta}
              className="mt-7"
            />
            <p className="text-ink/70 mt-4 text-xs font-bold">
              {finalOffer.secure}
            </p>
          </div>
        </div>
      </div>
      <footer className="mx-auto mt-12 max-w-3xl px-5 text-center text-xs leading-relaxed text-slate-600">
        <Wordmark height={56} className="mx-auto mb-2" />
        <p className="mt-4">{DISCLAIMER}</p>
        <p className="text-ink mt-4 font-bold">© 2026 Vendingpreneurs</p>
        <p className="mt-2">
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center px-2 underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          {" · "}
          <Link
            href="/terms"
            className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 underline underline-offset-2"
          >
            Terms
          </Link>
        </p>
      </footer>
    </section>
  );
}
