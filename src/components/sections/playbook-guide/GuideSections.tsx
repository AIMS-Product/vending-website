import Image from "next/image";
import { Wordmark } from "@/components/site/Wordmark";
import { Highlight } from "@/components/ui/Highlight";
import {
  GuidePageViewer,
  LockedBadge,
} from "@/components/sections/playbook-guide/GuidePageViewer";
import {
  CheckIcon,
  CheckList,
  EYEBROW,
} from "@/components/sections/playbook/PlaybookCta";
import { applyTestimonials } from "@/lib/content/apply-page";
import { images as playbookImages } from "@/lib/content/playbook";
import {
  GUIDE,
  guideFaq,
  guideHost,
  guideOffer,
  plays,
} from "@/lib/content/playbook-guide";
import { guideImages } from "@/lib/content/playbook-guide-images";

interface BuyProps {
  buy: React.ReactNode;
}

const TRUST = ["Secure checkout by Stripe", "Instant PDF download"];
/** Below-the-fold headings stay a step under the hero (Adam 10-20: no second heroes). */
const H2 =
  "v2-display text-ink text-[clamp(1.9rem,3.4vw,2.75rem)] leading-[1.04] uppercase";
const SECTION_Y = "py-12 lg:py-16";
/** Small step marker in place of the giant outlined numerals. */
const STEP = "text-brand-700 text-sm font-black tabular-nums";

/** Checkout-style order summary: product line, what's inside, total, one button. */
function OrderCard({ buy }: BuyProps) {
  return (
    <div className="border-ink border-2 bg-white shadow-[6px_6px_0_#111111]">
      <div className="border-ink flex items-center gap-4 border-b-2 p-4 sm:p-5">
        <Image
          src={guideImages.cover.src}
          alt=""
          width={guideImages.cover.width}
          height={guideImages.cover.height}
          sizes="112px"
          className="border-ink h-auto w-20 shrink-0 border-2 sm:w-28"
        />
        <div className="min-w-0 flex-1">
          <p className="text-ink leading-tight font-black">{GUIDE.title}</p>
          <p className="text-ink/65 mt-1 text-sm">PDF + 8 videos</p>
        </div>
        <p className="text-ink text-lg font-black tabular-nums">
          {GUIDE.priceLabel}
        </p>
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-ink/60 text-xs font-black tracking-[0.12em] uppercase">
          What you get
        </p>
        <CheckList
          items={guideOffer.includes}
          className="text-ink mt-3 space-y-1.5 text-[15px]"
        />
        <div className="mt-5 flex items-baseline justify-between border-t border-dashed border-[#111111]/30 pt-4">
          <span className="text-ink font-bold">Total today</span>
          <span className="text-ink text-xl font-black tabular-nums">
            {GUIDE.priceLabel}.00{" "}
            <span className="text-ink/60 text-xs font-bold">USD</span>
          </span>
        </div>
        <p className="text-ink/60 mt-1 text-xs">
          One-time payment. No subscription.
        </p>
        <div className="mt-4">{buy}</div>
        <ul className="text-ink/60 mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-bold">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <CheckIcon className="text-brand-600 size-3.5 shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function GuideHero({ buy, notice }: BuyProps & { notice?: string }) {
  const [first, highlight, last] = guideOffer.headlineLines;
  return (
    <section className="border-ink v2-dots relative overflow-hidden border-b-2 bg-white">
      <div className="mx-auto max-w-[1180px] px-5 pt-5 lg:px-10 lg:pt-7">
        <Wordmark height={32} eager />
      </div>
      <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 pt-6 pb-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-14 lg:px-10 lg:pt-10 lg:pb-16">
        <div className="relative z-10">
          {notice ? (
            <p
              role="alert"
              className="border-ink bg-ui-warn-fill text-ui-warn-ink mb-5 border-2 px-4 py-3 text-sm font-bold"
            >
              {notice}
            </p>
          ) : null}
          <p className={EYEBROW}>{guideOffer.eyebrow}</p>
          <h1 className="v2-display text-ink mt-3 text-[clamp(2.5rem,5.4vw,4.5rem)] leading-[1.06] uppercase">
            <span className="block">{first}</span>
            <span className="block">
              <Highlight>{highlight}</Highlight>
            </span>
            <span className="block">{last}</span>
          </h1>
          <p className="text-ink/80 mt-5 max-w-xl text-lg leading-snug">
            {guideOffer.sub}
          </p>
          <div className="mt-7">{buy}</div>
          <p className="text-ink/60 mt-3 text-sm font-bold">
            One-time payment · Instant PDF download · Secure checkout by Stripe
          </p>
        </div>
        <GuidePageViewer pages={guideImages.viewer} totalPages={12} />
      </div>
    </section>
  );
}

export function GuideBenefits() {
  return (
    <section className="border-ink border-b-2 bg-white">
      <div className={`mx-auto max-w-[1240px] px-5 ${SECTION_Y} lg:px-12`}>
        <h2 className={H2}>What you&rsquo;ll walk away with</h2>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {guideOffer.benefits.map((b, i) => (
            <li
              key={b.title}
              className="border-ink bg-brand-50 border-2 p-6 shadow-[6px_6px_0_#111111]"
            >
              <span className={STEP}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-ink mt-2 text-xl font-black">{b.title}</h3>
              <p className="text-ink/80 mt-2 leading-snug">{b.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function GuideInside() {
  return (
    <section className="border-ink bg-brand-50 border-b-2">
      <div className={`mx-auto max-w-[1240px] px-5 ${SECTION_Y} lg:px-12`}>
        <p className={EYEBROW}>{guideOffer.previewTitle}</p>
        <h2 className={`${H2} mt-3`}>Real pages from the playbook</h2>
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
          {guideImages.previews.map((page, i) => (
            <li
              key={page.src}
              className={`relative ${i > 1 ? "max-sm:hidden" : ""}`}
            >
              <Image
                src={page.src}
                alt={page.alt}
                width={page.width}
                height={page.height}
                sizes="(min-width: 1240px) 380px, (min-width: 640px) 33vw, 50vw"
                className="border-ink h-auto w-full border-2 bg-white shadow-[5px_5px_0_#111111]"
              />
              {page.locked ? <LockedBadge compact /> : null}
            </li>
          ))}
        </ul>
        <h3 className="v2-display text-ink mt-12 text-2xl uppercase sm:text-3xl">
          {guideOffer.contentsTitle}
        </h3>
        <ol className="border-ink mt-6 divide-y-2 divide-[#111111] border-2 bg-white">
          {plays.map((play) => (
            <li
              key={play.number}
              className="flex gap-4 px-5 py-4 sm:items-baseline"
            >
              <span className={`${STEP} w-6 shrink-0 pt-1 sm:pt-0`}>
                {play.number}
              </span>
              <div>
                <p className="text-ink text-lg font-black">{play.title}</p>
                <p className="text-ink/75 leading-snug">{play.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function GuideFinalOffer({ buy }: BuyProps) {
  return (
    <section className="v2-dots bg-white">
      <div className={`mx-auto max-w-[520px] px-5 ${SECTION_Y}`}>
        <h2 className="v2-display text-ink text-center text-[clamp(2rem,4vw,2.75rem)] leading-[1.04] uppercase">
          Start on play one tonight
        </h2>
        <div className="mt-8">
          <OrderCard buy={buy} />
        </div>
        <p className="text-ink/55 mt-8 text-center text-xs leading-relaxed">
          {guideOffer.disclaimer}
        </p>
      </div>
    </section>
  );
}

const REVIEW_NAMES = ["Kyle Sharp", "Joe Natoli", "Kelsey Corcoran"];

export function GuideProof() {
  const reviews = applyTestimonials.cards.filter((c) =>
    REVIEW_NAMES.includes(c.name),
  );
  const mike = playbookImages.mike;
  return (
    <section className="border-ink border-b-2 bg-white">
      <div
        className={`mx-auto grid max-w-[1240px] gap-10 px-5 ${SECTION_Y} lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 lg:px-12`}
      >
        <div className="flex items-start gap-5">
          <Image
            src={mike.src}
            alt={mike.alt}
            width={mike.width}
            height={mike.height}
            sizes="140px"
            className="border-ink w-28 shrink-0 border-2 shadow-[5px_5px_0_#111111] sm:w-36"
          />
          <div>
            <p className={EYEBROW}>{guideHost.eyebrow}</p>
            <h2 className="v2-display text-ink mt-2 text-4xl uppercase">
              {guideHost.title}
            </h2>
            <p className="text-ink/65 text-sm font-bold">{guideHost.role}</p>
            {guideHost.paragraphs.map((p) => (
              <p key={p} className="text-ink/80 mt-3 leading-snug">
                {p}
              </p>
            ))}
          </div>
        </div>
        <ul className="grid gap-4">
          {reviews.map((r) => (
            <li
              key={r.name}
              className="border-ink bg-brand-50 flex gap-4 border-2 p-5 shadow-[5px_5px_0_#111111]"
            >
              <Image
                src={r.headshot}
                alt=""
                width={56}
                height={56}
                className="border-ink size-14 shrink-0 rounded-full border-2 object-cover"
              />
              <div>
                <p className="text-ink leading-snug">&ldquo;{r.quote}&rdquo;</p>
                <p className="text-ink mt-2 text-sm font-black">{r.name}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function GuideFaq() {
  return (
    <section className="border-ink bg-brand-50 border-b-2">
      <div className={`mx-auto max-w-[860px] px-5 ${SECTION_Y}`}>
        <h2 className={H2}>Questions</h2>
        <div className="border-ink mt-6 divide-y-2 divide-[#111111] border-2 bg-white">
          {guideFaq.map((item) => (
            <details key={item.q} className="group">
              <summary className="text-ink focus-visible:outline-brand-600 flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-lg font-black focus-visible:outline-2 focus-visible:-outline-offset-4 [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden
                  className="text-brand-700 text-2xl leading-none transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
              </summary>
              <p className="text-ink/80 px-5 pb-4 leading-snug">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
