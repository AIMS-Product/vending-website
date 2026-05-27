import Image from "next/image";
import { about } from "@/lib/content/about";

export function AboutHero() {
  return (
    <section className="relative isolate overflow-hidden border-b-2 border-[#111111] bg-[#f5fbff]">
      <div className="mx-auto grid max-w-[1500px] items-center gap-12 px-5 pt-28 pb-20 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:pt-32 lg:pb-28">
        <div className="flex flex-col justify-center">
          <p className="inline-flex w-fit rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
            {about.hero.eyebrow}
          </p>
          <h1 className="mt-8 text-[clamp(3rem,6vw,5.8rem)] leading-[0.95] font-black text-[#111111] uppercase">
            {about.hero.title}
          </h1>

          <div className="mt-8 max-w-xl space-y-5 text-xl leading-8 font-semibold text-slate-700">
            {about.hero.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-[12px] border-2 border-[#111111] bg-white shadow-[10px_10px_0_#55b8e8]">
          <Image
            src={about.hero.image.src}
            alt={about.hero.image.alt}
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
