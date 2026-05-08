import Image from "next/image";
import { about } from "@/lib/content/about";

export function AboutHow() {
  return (
    <section className="bg-white px-5 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto flex max-w-[900px] flex-col items-center gap-12 text-center">
        <h2 className="text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
          {about.how.title.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h2>

        <div className="space-y-6 text-left text-lg leading-8 font-semibold text-slate-700 sm:text-center">
          {about.how.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mt-16 aspect-[16/9] w-full max-w-[1260px] overflow-hidden rounded-[12px] border-2 border-[#111111] shadow-[10px_10px_0_#55b8e8]">
        <Image
          src={about.how.image.src}
          alt={about.how.image.alt}
          fill
          sizes="(max-width: 1260px) 100vw, 1260px"
          loading="eager"
          className="object-cover"
        />
      </div>
    </section>
  );
}
