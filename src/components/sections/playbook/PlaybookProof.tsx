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
import { EYEBROW, H2, PlaybookCtaBand } from "./PlaybookCta";

interface PlaybookProofProps {
  checkoutHref: string;
}

export function PlaybookOpportunity({ checkoutHref }: PlaybookProofProps) {
  return (
    <section className="border-ink border-b-2 bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <p className={EYEBROW}>{opportunity.eyebrow}</p>
        <h2 data-reveal className={`${H2} mt-2`}>
          {opportunity.headline[0]}{" "}
          <Highlight>{opportunity.headline[1]}</Highlight>{" "}
          {opportunity.headline[2]}.
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {opportunity.points.map((p) => (
            <li key={p.lead} data-reveal>
              <Card variant="flat" className="h-full">
                <p className="leading-snug">
                  <strong className="font-black">{p.lead}</strong>
                  {p.tail ? ` ${p.tail}` : null}
                </p>
              </Card>
            </li>
          ))}
        </ul>
        <PlaybookCtaBand href={checkoutHref} label={BUY_CTA_SHORT} />
      </div>
    </section>
  );
}

export function PlaybookStories({ checkoutHref }: PlaybookProofProps) {
  const [before, after] = stories.title.split(stories.highlight);
  return (
    <section className="bg-brand-50 border-ink border-b-2 py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <p className={EYEBROW}>{stories.eyebrow}</p>
        <h2 data-reveal className={`${H2} mt-2`}>
          {before}
          <Highlight>{stories.highlight}</Highlight>
          {after}
        </h2>
        <p className="mt-4 max-w-3xl leading-snug">{stories.intro}</p>
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Image
            src={images.results.src}
            alt={images.results.alt}
            width={images.results.width}
            height={images.results.height}
            sizes="(min-width: 1024px) 460px, 100vw"
            className="border-ink shadow-card rounded-card h-auto w-full border-2"
          />
          <ul className="grid gap-4">
            {stories.items.map((s) => (
              <li key={s.name} data-reveal>
                <Card as="figure">
                  <blockquote className="leading-snug">{s.text}</blockquote>
                  <figcaption className="text-ink mt-3 font-black uppercase">
                    {s.name}
                  </figcaption>
                </Card>
              </li>
            ))}
          </ul>
        </div>
        <PlaybookCtaBand href={checkoutHref} label={BUY_CTA_SHORT} />
      </div>
    </section>
  );
}

export function PlaybookCompare() {
  return (
    <section className="border-ink border-b-2 bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-[1180px] px-5 lg:px-10">
        <h2 data-reveal className={H2}>
          {compare.title}
        </h2>
        <p className="mt-4 max-w-3xl leading-snug">{compare.intro}</p>
        <div className="border-ink shadow-card rounded-card mt-8 overflow-x-auto border-2">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-ink bg-brand-50 border-b-2">
                <td className="p-3" />
                {compare.columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={`p-3 font-black uppercase ${i === 0 ? "text-brand-700" : ""}`}
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
                  className="border-ink/20 border-b last:border-0"
                >
                  <th scope="row" className="p-3 font-bold">
                    {label}
                  </th>
                  {cells.map((c, i) => (
                    <td
                      key={i}
                      className={`p-3 ${i === 0 ? "text-ink font-black" : ""}`}
                    >
                      {c}
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
