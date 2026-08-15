import Image from "next/image";
import { SubscribeForm } from "@/components/SubscribeForm";
import { closing, hero } from "@/lib/content";

export function ClosingCta() {
  return (
    <section className="relative isolate overflow-hidden bg-accent-deep">
      <Image
        src="/images/cta.avif"
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        className="-z-10 object-cover"
      />
      {/* The photograph is texture, not information: it stays under a heavy
          wash so the type keeps its contrast on every screen. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-accent-deep/95" />

      <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center sm:px-8 lg:py-24">
        <h2 className="font-display text-3xl leading-tight text-balance text-ink-inverse sm:text-4xl lg:text-[2.75rem]">
          {closing.heading}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/70">
          {closing.body}
        </p>
        <div className="mx-auto mt-9 max-w-lg text-left">
          <SubscribeForm
            id="closing"
            source="closing"
            tone="dark"
            note={hero.formNote}
          />
        </div>
      </div>
    </section>
  );
}
