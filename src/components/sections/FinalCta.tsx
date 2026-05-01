import { Button } from "@/components/ui/Button";
import { finalCta } from "@/lib/content/home";

export function FinalCta() {
  return (
    <section className="px-6 py-20 lg:px-10 lg:py-24">
      <div className="via-brand-100 to-brand-300 mx-auto grid max-w-[1400px] overflow-hidden rounded-3xl bg-gradient-to-r from-white shadow-md lg:grid-cols-2">
        <div className="flex flex-col justify-center gap-6 p-10 lg:p-14">
          <h2 className="text-brand-500 text-4xl font-semibold tracking-tight sm:text-5xl">
            {finalCta.title}
          </h2>
          <p className="max-w-md text-slate-600">{finalCta.body}</p>
          <div>
            <Button href={finalCta.cta.href}>{finalCta.cta.label}</Button>
          </div>
        </div>

        <FinalCtaImagePlaceholder />
      </div>
    </section>
  );
}

/** Slice 1b — replace with the live "tap to pay at vending machine" image. */
function FinalCtaImagePlaceholder() {
  return (
    <div
      aria-hidden
      className="from-brand-300 via-brand-400 to-brand-500 aspect-[4/3] w-full bg-gradient-to-br lg:aspect-auto"
    >
      <div className="flex h-full items-end p-8">
        <p className="text-brand-700 rounded-xl bg-white/70 p-3 text-xs backdrop-blur">
          Image placeholder — swap to live asset in Slice 1b.
        </p>
      </div>
    </div>
  );
}
