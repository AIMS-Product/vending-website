import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { hero } from "@/lib/content/home";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 [background:var(--gradient-hero)]" />

      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-6 pt-32 pb-20 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:pt-40 lg:pb-28">
        <div className="flex flex-col justify-center">
          <h1 className="text-brand-500 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {hero.title.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h1>

          <div className="mt-8 max-w-md space-y-5 text-base text-slate-600">
            {hero.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="mt-10">
            <Button href={hero.cta.href}>{hero.cta.label}</Button>
          </div>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-white/40">
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
