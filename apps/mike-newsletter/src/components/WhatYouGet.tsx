import Image from "next/image";
import { whatYouGet } from "@/lib/content";

export function WhatYouGet() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 lg:py-28">
        <p className="eyebrow text-accent">{whatYouGet.eyebrow}</p>
        <h2 className="font-display mt-4 max-w-2xl text-3xl leading-tight text-balance sm:text-4xl lg:text-[2.75rem]">
          {whatYouGet.heading}
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:gap-12">
          {whatYouGet.issues.map((issue) => (
            <article
              key={issue.number}
              className="overflow-hidden rounded-lg border border-rule bg-paper-raised"
            >
              <Image
                src={issue.image}
                alt={issue.alt}
                width={1200}
                height={750}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="aspect-[16/10] w-full border-b border-rule object-cover"
              />
              <div className="p-7 lg:p-8">
                <p className="eyebrow tabular-nums text-ink-subtle">
                  Issue {issue.number}
                </p>
                <h3 className="font-display mt-3 text-2xl">{issue.title}</h3>
                <p className="mt-3 leading-7 text-ink-muted">{issue.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
