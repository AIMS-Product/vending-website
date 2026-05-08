import Image from "next/image";
import { about } from "@/lib/content/about";

export function AboutApproach() {
  return (
    <section className="border-y-2 border-[#111111] bg-[#f5fbff] px-5 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-[1500px] items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[12px] border-2 border-[#111111] shadow-[10px_10px_0_#55b8e8]">
          <Image
            src={about.approach.image.src}
            alt={about.approach.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            loading="eager"
            className="object-cover object-top"
          />
        </div>

        <div>
          <h2 className="text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
            {about.approach.title}
          </h2>
          <div className="mt-6 max-w-xl space-y-5 text-lg leading-8 font-semibold text-slate-700">
            {about.approach.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
