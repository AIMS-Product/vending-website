import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type {
  ContentPage as ContentPageData,
  PageCta,
  PageFeature,
  PageMedia,
  PageRelated,
  PageStep,
  PageTestimonial,
} from "@/lib/content/content-page";

const CARD =
  "rounded-[12px] border-2 border-[#111111] bg-white shadow-[8px_8px_0_#55b8e8]";
const EYEBROW = "text-xs font-black tracking-[0.14em] text-brand-700 uppercase";
const SECTION = "px-5 py-20 lg:px-10 lg:py-28";
const WRAP = "mx-auto max-w-[1500px]";

/**
 * The template behind `/solutions/<slug>` and `/process/<slug>`. Every section
 * is driven by the record; sections with no content (testimonials, related)
 * are skipped rather than rendered empty.
 */
export function ContentPage({ page }: { page: ContentPageData }) {
  return (
    <>
      <Hero page={page} />
      {page.testimonials.length > 0 && (
        <Proof testimonials={page.testimonials} />
      )}
      <Thesis thesis={page.thesis} steps={page.steps} />
      <Features features={page.features} />
      <Closing closing={page.closing} />
      {page.related.length > 0 && <Related related={page.related} />}
    </>
  );
}

function Hero({ page }: { page: ContentPageData }) {
  return (
    <section className={`bg-white ${SECTION}`}>
      <div className={WRAP}>
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
            <li>
              <Link href="/" className="hover:text-brand-700">
                Home
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li>
              <Link href={page.parent.href} className="hover:text-brand-700">
                {page.parent.label}
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li aria-current="page" className="text-[#111111]">
              {page.breadcrumb}
            </li>
          </ol>
        </nav>

        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="min-w-0">
            <p className={EYEBROW}>{page.eyebrow}</p>
            <h1 className="mt-4 text-4xl leading-tight font-black break-words text-[#111111] uppercase sm:text-5xl lg:text-6xl">
              {page.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 font-semibold text-slate-700">
              {page.intro}
            </p>
            <CtaRow ctas={page.ctas} className="mt-8" />
          </div>
          <Media
            media={page.hero}
            className="shadow-[10px_10px_0_#55b8e8]"
            sizes="(max-width: 1024px) 100vw, 45vw"
            priority
          />
        </div>
      </div>
    </section>
  );
}

function Proof({
  testimonials,
}: {
  testimonials: ReadonlyArray<PageTestimonial>;
}) {
  return (
    <section className={`bg-[#f5fbff] ${SECTION}`}>
      <div className={WRAP}>
        <h2 className={EYEBROW}>What operators say</h2>
        <ul className="mt-8 grid gap-8 lg:grid-cols-3">
          {testimonials.map((item) => (
            <li key={item.name + item.topic} className={`${CARD} p-7`}>
              <p className={EYEBROW}>{item.topic}</p>
              <blockquote className="mt-4 text-lg leading-7 font-semibold text-[#111111]">
                “{item.quote}”
              </blockquote>
              <div className="mt-6 flex items-center gap-4">
                <div className="relative size-11 shrink-0 overflow-hidden rounded-full border-2 border-[#111111] bg-[#eaf8ff]">
                  {item.avatar && (
                    <Image
                      src={item.avatar}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div>
                  <div className="font-black text-[#111111]">{item.name}</div>
                  <div className="text-sm font-semibold text-slate-600">
                    {item.meta}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Thesis({
  thesis,
  steps,
}: {
  thesis: string;
  steps: ReadonlyArray<PageStep>;
}) {
  return (
    <section className={`bg-white ${SECTION}`}>
      <div className={WRAP}>
        <h2 className="mx-auto max-w-4xl text-center text-3xl leading-tight font-black text-[#111111] uppercase sm:text-4xl">
          {thesis}
        </h2>
        <ul className="mt-14 grid gap-8 lg:grid-cols-3">
          {steps.map((step, index) => {
            // The middle step is filled: it is the one that carries the
            // argument, and an all-white row of three reads as a list.
            const filled = index === 1;
            return (
              <li
                key={step.label}
                className={`${CARD} p-7 ${filled ? "bg-[#eaf8ff] shadow-[8px_8px_0_#111111]" : ""}`}
              >
                <p className={EYEBROW}>{step.label}</p>
                <h3 className="mt-3 text-xl font-black text-[#111111] uppercase">
                  {step.title}
                </h3>
                <p className="mt-3 font-semibold text-slate-700">{step.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Features({ features }: { features: ReadonlyArray<PageFeature> }) {
  return (
    <section className={`bg-[#f5fbff] ${SECTION}`}>
      <div className={`${WRAP} flex flex-col gap-20 lg:gap-28`}>
        {features.map((feature, index) => (
          <FeatureBlock
            key={feature.eyebrow}
            feature={feature}
            // Alternate which side the visual sits on so a run of blocks
            // doesn't read as one long column.
            mediaFirst={index % 2 === 1}
          />
        ))}
      </div>
    </section>
  );
}

function FeatureBlock({
  feature,
  mediaFirst,
}: {
  feature: PageFeature;
  mediaFirst: boolean;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <Media
        media={feature.media}
        className={mediaFirst ? "" : "lg:order-2"}
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
      <div className="min-w-0">
        <p className={EYEBROW}>{feature.eyebrow}</p>
        <h2 className="mt-4 text-3xl leading-tight font-black break-words text-[#111111] uppercase sm:text-4xl">
          {feature.title}
        </h2>
        <p className="mt-5 text-lg leading-8 font-semibold text-slate-700">
          {feature.body}
        </p>
        <ul className="mt-7 space-y-4">
          {feature.points.map((point) => (
            <li key={point} className="flex gap-4">
              <CheckIcon />
              <span className="font-semibold text-slate-700">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Closing({ closing }: { closing: ContentPageData["closing"] }) {
  return (
    <section className={`bg-white ${SECTION}`}>
      <div
        className={`${WRAP} ${CARD} px-6 py-14 text-center shadow-[10px_10px_0_#55b8e8] lg:px-16`}
      >
        <h2 className="mx-auto max-w-3xl text-3xl leading-tight font-black text-[#111111] uppercase sm:text-4xl">
          {closing.title}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 font-semibold text-slate-700">
          {closing.body}
        </p>
        <CtaRow ctas={closing.ctas} className="mt-8 justify-center" />
      </div>
    </section>
  );
}

function Related({ related }: { related: ReadonlyArray<PageRelated> }) {
  return (
    <section className={`bg-[#f5fbff] ${SECTION}`}>
      <div className={WRAP}>
        <h2 className={EYEBROW}>Explore more</h2>
        <ul className="mt-8 grid gap-8 lg:grid-cols-3">
          {related.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${CARD} block h-full p-7 shadow-[8px_8px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[10px_10px_0_#111111] focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none`}
              >
                <h3 className="text-xl font-black text-[#111111] uppercase">
                  {item.title}
                </h3>
                <p className="mt-3 font-semibold text-slate-700">{item.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CtaRow({
  ctas,
  className,
}: {
  ctas: ReadonlyArray<PageCta>;
  className?: string;
}) {
  if (ctas.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-4 ${className ?? ""}`}>
      {ctas.map((cta) => (
        <Button
          key={cta.href + cta.label}
          href={cta.href}
          variant={cta.variant ?? "primary"}
        >
          {cta.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * Product visual. A video if the record has one, else a still, else a bordered
 * frame labelled with the alt text so copy can ship ahead of its visuals.
 *
 * Videos are `preload="none"`: only the poster JPEG is fetched on load, so a
 * page can carry four walkthroughs without paying for them until someone
 * presses play. They loop muted so a click plays in place rather than
 * hijacking the page with sound.
 */
function Media({
  media,
  className,
  sizes,
  priority = false,
}: {
  media: PageMedia;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  // The frame takes the asset's own ratio when it has one. Forcing 16:9 on a
  // 1700x1080 screen recording pillarboxes it with black bars; the inline
  // ratio also reserves the right height before the poster loads, so there is
  // no layout shift either.
  const ratio =
    media.width && media.height
      ? { aspectRatio: `${media.width} / ${media.height}` }
      : undefined;
  const frame = `relative w-full overflow-hidden rounded-[12px] border-2 border-[#111111] bg-[#eaf8ff] shadow-[8px_8px_0_#55b8e8] ${ratio ? "" : "aspect-video"} ${className ?? ""}`;

  if (media.video) {
    return (
      <div className={frame} style={ratio}>
        {/* No <track>: these are silent UI screen recordings with no speech,
            and the surrounding copy carries the same content. */}
        <video
          className="h-full w-full object-cover"
          controls
          muted
          loop
          playsInline
          preload="none"
          poster={media.poster}
          aria-label={media.alt}
        >
          <source src={media.video} type="video/mp4" />
        </video>
      </div>
    );
  }

  if (!media.src) {
    return (
      <div
        role="img"
        aria-label={media.alt}
        className={`${frame} flex items-end justify-center`}
      >
        <span className="p-4 text-sm font-semibold text-slate-500">
          {media.alt}
        </span>
      </div>
    );
  }

  return (
    <div className={frame} style={ratio}>
      <Image
        src={media.src}
        alt={media.alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}

function CheckIcon() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[#111111] bg-white text-[#111111]"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-3.5">
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
