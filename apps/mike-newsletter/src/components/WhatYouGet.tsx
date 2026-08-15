import Image from "next/image";
import { whatYouGet } from "@/lib/content";

export function WhatYouGet() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16">
          <div>
            <p className="eyebrow text-accent">{whatYouGet.eyebrow}</p>
            <h2 className="font-display mt-4 text-3xl leading-tight text-balance sm:text-4xl lg:text-[2.75rem]">
              {whatYouGet.heading}
            </h2>
          </div>
          <p className="max-w-xl leading-7 text-ink-muted lg:pb-2">
            {whatYouGet.lede}
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:mt-14 lg:gap-10">
          {whatYouGet.issues.map((issue) => (
            <article
              key={issue.number}
              className="flex flex-col overflow-hidden rounded-lg border border-rule bg-paper-raised"
            >
              <Image
                src={issue.image}
                alt={issue.alt}
                width={1200}
                height={750}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="aspect-[16/10] w-full border-b border-rule object-cover"
              />
              <div className="flex flex-1 flex-col p-6 lg:p-8">
                <p className="eyebrow text-ink-subtle tabular-nums">
                  Issue {issue.number}
                </p>
                <h3 className="font-display mt-3 text-2xl">{issue.title}</h3>
                <p className="mt-2 leading-7 text-ink-muted">{issue.body}</p>

                {/* Bullets, not prose: this is the block a skimmer stops on,
                    and three short lines answer "what's actually in it" faster
                    than a paragraph they won't finish. */}
                <ul className="mt-5 space-y-2.5 border-t border-rule pt-5">
                  {issue.points.map((point) => (
                    <li
                      key={point}
                      className="flex gap-3 text-[0.9375rem] leading-6"
                    >
                      <span
                        aria-hidden
                        className="mt-2 inline-block h-px w-3 shrink-0 bg-accent"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
