import Image from "next/image";
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

        <div className="relative aspect-[4/3] w-full lg:aspect-auto">
          <Image
            src={finalCta.image.src}
            alt={finalCta.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
