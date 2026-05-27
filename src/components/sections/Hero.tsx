import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { hero } from "@/lib/content/home";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b-2 border-[#111111] bg-[#f5fbff]">
      <div className="mx-auto grid max-w-[1500px] items-center gap-12 px-5 pt-16 pb-12 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:pt-20 lg:pb-14">
        <div className="flex flex-col justify-center">
          <h1 className="text-[clamp(3rem,5.2vw,5.15rem)] leading-[0.92] font-black text-[#111111] uppercase">
            {hero.title.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>

          <div className="mt-7 max-w-xl space-y-4 text-lg leading-8 font-semibold text-slate-700">
            {hero.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          <div className="mt-8">
            <Button href={hero.cta.href}>{hero.cta.label}</Button>
          </div>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-[12px] border-2 border-[#111111] bg-white shadow-[10px_10px_0_#55b8e8] lg:aspect-[5/4]">
          <Image
            src={hero.image.src}
            alt={hero.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
