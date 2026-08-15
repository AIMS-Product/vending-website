import Image from "next/image";
import { field } from "@/lib/content";

export function FromTheField() {
  return (
    <section className="border-b border-rule bg-paper-deep">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <Image
          src={field.image}
          alt={field.alt}
          width={1000}
          height={1150}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="aspect-[4/5] w-full rounded-lg border border-rule-strong object-cover lg:order-last"
        />

        <div>
          <p className="eyebrow text-accent">{field.eyebrow}</p>
          <h2 className="font-display mt-4 text-3xl leading-tight text-balance sm:text-4xl lg:text-[2.75rem]">
            {field.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-ink-muted">{field.body}</p>

          <blockquote className="mt-9 border-l-2 border-accent pl-6">
            <p className="font-display text-xl leading-8 text-ink">
              {field.pullQuote}
            </p>
          </blockquote>
        </div>
      </div>
    </section>
  );
}
