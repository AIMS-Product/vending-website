import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { finalCta } from "@/lib/content/home";

export function FinalCta() {
  return (
    <section className="bg-[#f5fbff] px-5 py-20 lg:px-10 lg:py-24">
      <div className="mx-auto grid max-w-[1500px] overflow-hidden rounded-[12px] border-2 border-[#111111] bg-white shadow-[10px_10px_0_#55b8e8] lg:grid-cols-2">
        <div className="flex flex-col justify-center gap-6 p-10 lg:p-14">
          <h2 className="text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
            {finalCta.title}
          </h2>
          <p className="max-w-md text-lg leading-8 font-semibold text-slate-700">
            {finalCta.body}
          </p>
          <div>
            <Button href={finalCta.cta.href}>{finalCta.cta.label}</Button>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full border-t-2 border-[#111111] lg:aspect-auto lg:border-t-0 lg:border-l-2">
          <Image
            src={finalCta.image.src}
            alt={finalCta.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            loading="eager"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
