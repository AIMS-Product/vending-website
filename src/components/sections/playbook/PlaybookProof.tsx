import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Highlight } from "@/components/ui/Highlight";
import {
  BUY_CTA,
  compare,
  images,
  opportunity,
  opportunityQuotes,
  stories,
} from "@/lib/content/playbook";
import { cn } from "@/lib/utils";
import { CheckIcon, EYEBROW, H2, PlaybookCta } from "./PlaybookCta";

interface PlaybookProofProps {
  checkoutHref: string;
}

function Emphasis({ text, phrase }: { text: string; phrase: string }) {
  const [before, after] = text.split(phrase);
  return (
    <>
      {before}
      <Highlight>{phrase}</Highlight>
      {after}
    </>
  );
}

type Quote = (typeof opportunityQuotes)[number];

const AVATAR_PX = 56;

/**
 * The face from GHL's approved group image, cropped to its square. A
 * next/image inside a clipped circle, so it ships a 2x srcset, not the
 * flattened 519px image.
 */
function QuoteAvatar({ crop }: { crop: Quote["crop"] }) {
  const scale = AVATAR_PX / crop.size;
  return (
    <span
      aria-hidden="true"
      className="border-ink relative block size-14 shrink-0 overflow-hidden rounded-full border-2 bg-white"
    >
      <Image
        src={images.results.src}
        alt=""
        width={Math.round(images.results.width * scale)}
        height={Math.round(images.results.height * scale)}
        sizes={`${Math.round(images.results.width * scale)}px`}
        className="absolute max-w-none"
        style={{
          left: -crop.x * scale - 2,
          top: -crop.y * scale - 2,
        }}
      />
    </span>
  );
}

function QuoteCard({ q }: { q: Quote }) {
  return (
    <figure className="rounded-card border-ink shadow-card flex gap-4 border-2 bg-white p-5">
      <QuoteAvatar crop={q.crop} />
      <div className="min-w-0">
        <figcaption className="text-ink text-[13px] font-black tracking-[0.14em] uppercase">
          {q.name}
        </figcaption>
        <blockquote className="text-ink mt-1.5 text-[15px] leading-snug font-bold">
          {q.quote}
        </blockquote>
      </div>
    </figure>
  );
}

export function PlaybookOpportunity() {
  return (
    <section className="bg-brand-50 border-ink border-b-2 py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <p className={EYEBROW}>{opportunity.eyebrow}</p>
        <h2 data-reveal className={`${H2} mt-3 max-w-4xl`}>
          <Emphasis
            text={opportunity.headline}
            phrase={opportunity.highlight}
          />
        </h2>
        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
          <ul data-reveal className="space-y-5">
            {opportunityQuotes.map((q) => (
              <li key={q.name}>
                <QuoteCard q={q} />
              </li>
            ))}
          </ul>
          <ul className="divide-ink/15 divide-y-2">
            {opportunity.points.map((p) => (
              <li key={p.lead} className="flex gap-4 py-4 first:pt-0">
                <CheckIcon className="text-brand-600 mt-0.5 size-6 shrink-0" />
                <p className="text-[1.05rem] leading-snug">
                  <strong className="text-ink font-black">{p.lead}</strong>{" "}
                  {p.tail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

type Story = (typeof stories.items)[number];

/** One 64px square per story: the member photo, or their initial. */
function StoryAvatar({ story }: { story: Story }) {
  const box =
    "border-ink rounded-control block size-16 shrink-0 overflow-hidden border-2";
  if ("photo" in story && story.photo) {
    const zoom = "zoom" in story.photo ? story.photo.zoom : 1;
    return (
      <span aria-hidden="true" className={box}>
        <Image
          src={story.photo.src}
          alt=""
          width={story.photo.width}
          height={story.photo.height}
          sizes="128px"
          className="size-full object-cover object-[50%_30%]"
          style={zoom === 1 ? undefined : { transform: `scale(${zoom})` }}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        box,
        "bg-tint v2-display text-brand-700 grid place-items-center text-3xl",
      )}
    >
      {story.name.charAt(0)}
    </span>
  );
}

function StoryCard({ story }: { story: Story }) {
  return (
    <Card as="figure" className="flex h-full flex-col">
      <figcaption className="flex items-center gap-4">
        <StoryAvatar story={story} />
        <span className="v2-display text-ink text-3xl uppercase">
          {story.name}
        </span>
      </figcaption>
      <blockquote className="mt-5 text-[1.05rem] leading-relaxed">
        {story.text}
      </blockquote>
    </Card>
  );
}

export function PlaybookStories({ checkoutHref }: PlaybookProofProps) {
  return (
    <section className="bg-brand-50 border-ink border-b-2 py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <p className={EYEBROW}>{stories.eyebrow}</p>
        <h2 data-reveal className={`${H2} mt-3 max-w-4xl`}>
          <Emphasis text={stories.title} phrase={stories.highlight} />
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed">
          {stories.intro}
        </p>
        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {stories.items.map((s) => (
            <li key={s.name} data-reveal>
              <StoryCard story={s} />
            </li>
          ))}
        </ul>
        <div className="mt-12 flex justify-center">
          <PlaybookCta href={checkoutHref} label={BUY_CTA} />
        </div>
      </div>
    </section>
  );
}

export function PlaybookCompare() {
  return (
    <section className="border-ink border-b-2 bg-white py-16 lg:py-24">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-16 lg:px-10">
        <div>
          <h2 data-reveal className={H2}>
            {compare.title}
          </h2>
          <p className="mt-5 text-lg leading-relaxed">{compare.intro}</p>
        </div>
        {/* Phones: one stacked block per row; the table from sm up. */}
        <ul className="border-ink bg-ink shadow-card rounded-card grid gap-[2px] overflow-hidden border-2 sm:hidden">
          {compare.rows.map(([label, ours, ...others]) => (
            <li key={label} className="bg-white p-5">
              <h3 className="text-ink leading-snug font-black">{label}</h3>
              <div className="bg-tint text-ink rounded-control mt-3 px-3 py-2">
                <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
                  {compare.columns[0]}
                </p>
                <p className="mt-0.5 flex items-start gap-2 font-black">
                  <CheckIcon className="text-brand-600 mt-0.5 size-4 shrink-0" />
                  {ours}
                </p>
              </div>
              <dl className="text-ink/70 mt-3 grid grid-cols-2 gap-3 text-sm">
                {others.map((c, i) => (
                  <div key={compare.columns[i + 1]}>
                    <dt className="text-xs font-black tracking-[0.1em] uppercase">
                      {compare.columns[i + 1]}
                    </dt>
                    <dd className="mt-0.5">{c}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <div className="border-ink shadow-card rounded-card hidden overflow-hidden border-2 bg-white sm:block">
          <table className="w-full table-fixed text-left text-[0.95rem]">
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[24%]" />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="border-ink border-b-2">
                <td className="p-4" />
                {compare.columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      "p-4 align-bottom leading-tight font-black uppercase",
                      i === 0 ? "bg-brand-700 text-white" : "text-ink/70",
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.rows.map(([label, ...cells]) => (
                <tr
                  key={label}
                  className="border-ink/15 border-b-2 last:border-0"
                >
                  <th
                    scope="row"
                    className="text-ink p-4 leading-snug font-bold"
                  >
                    {label}
                  </th>
                  {cells.map((c, i) => (
                    <td
                      key={i}
                      className={cn(
                        "p-4 leading-snug",
                        i === 0 ? "bg-tint text-ink font-black" : "text-ink/70",
                      )}
                    >
                      {i === 0 ? (
                        <span className="flex items-start gap-1.5">
                          <CheckIcon className="text-brand-600 mt-0.5 size-4 shrink-0" />
                          {c}
                        </span>
                      ) : (
                        c
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
