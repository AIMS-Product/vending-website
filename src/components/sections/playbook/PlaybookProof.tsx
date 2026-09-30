import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Highlight } from "@/components/ui/Highlight";
import {
  BUY_CTA_SHORT,
  compare,
  images,
  opportunity,
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

export function PlaybookOpportunity({ checkoutHref }: PlaybookProofProps) {
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
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
          <Image
            data-reveal
            src={images.results.src}
            alt={images.results.alt}
            width={images.results.width}
            height={images.results.height}
            sizes="(min-width: 1024px) 520px, 100vw"
            className="mx-auto h-auto w-full max-w-[520px]"
          />
          <div>
            <ul className="divide-ink/15 divide-y-2">
              {opportunity.points.map((p) => (
                <li key={p.lead} className="flex gap-4 py-4 first:pt-0">
                  <CheckIcon className="text-brand-600 mt-0.5 size-6 shrink-0" />
                  <p className="text-[1.05rem] leading-snug">
                    <strong className="text-ink font-black">{p.lead}</strong>
                    {p.tail ? ` ${p.tail}` : null}
                  </p>
                </li>
              ))}
            </ul>
            <PlaybookCta
              href={checkoutHref}
              label={BUY_CTA_SHORT}
              className="mt-8 w-full sm:w-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

type Story = (typeof stories.items)[number];

function StoryCard({ story, featured }: { story: Story; featured: boolean }) {
  return (
    <Card
      as="figure"
      className={cn(
        "flex h-full flex-col",
        featured && "overflow-hidden p-0 lg:p-0",
      )}
    >
      {featured && story.photo ? (
        <Image
          src={story.photo.src}
          alt={story.photo.alt}
          width={story.photo.width}
          height={story.photo.height}
          sizes="(min-width: 1024px) 560px, 100vw"
          className="border-ink aspect-[16/9] w-full border-b-2 object-cover object-[50%_30%]"
        />
      ) : null}
      <div className={cn("flex flex-1 flex-col", featured && "p-6 lg:p-7")}>
        <figcaption className="v2-display text-ink text-3xl uppercase">
          {story.name}
        </figcaption>
        <blockquote className="mt-3 text-[1.05rem] leading-relaxed">
          {story.text}
        </blockquote>
      </div>
    </Card>
  );
}

export function PlaybookStories({ checkoutHref }: PlaybookProofProps) {
  const featured = stories.items.filter((s) => s.photo);
  const rest = stories.items.filter((s) => !s.photo);
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
          {featured.map((s) => (
            <li key={s.name} data-reveal>
              <StoryCard story={s} featured />
            </li>
          ))}
          {rest.map((s) => (
            <li key={s.name} data-reveal>
              <StoryCard story={s} featured={false} />
            </li>
          ))}
        </ul>
        <div className="mt-12 flex justify-center">
          <PlaybookCta href={checkoutHref} label={BUY_CTA_SHORT} />
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
        <div className="border-ink shadow-card rounded-card overflow-hidden border-2 bg-white">
          <table className="w-full table-fixed text-left text-[0.78rem] sm:text-[0.95rem]">
            <colgroup>
              <col className="w-[29%]" />
              <col className="w-[25%]" />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="border-ink border-b-2">
                <td className="p-2 sm:p-4" />
                {compare.columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      "p-2 align-bottom leading-tight font-black uppercase sm:p-4",
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
                    className="text-ink p-3 leading-snug font-bold sm:p-4"
                  >
                    {label}
                  </th>
                  {cells.map((c, i) => (
                    <td
                      key={i}
                      className={cn(
                        "p-2 leading-snug sm:p-4",
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
