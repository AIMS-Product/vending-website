import Image from "next/image";
import { about } from "@/lib/content/about";

export function AboutHow() {
  return (
    <section className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto flex max-w-[900px] flex-col items-center gap-12 text-center">
        <h2 className="text-brand-500 text-4xl font-semibold tracking-tight sm:text-5xl">
          {about.how.title.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h2>

        <div className="space-y-6 text-left text-slate-600 sm:text-center">
          {about.how.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mt-16 aspect-[16/9] w-full max-w-[1260px] overflow-hidden rounded-3xl shadow-lg">
        <Image
          src={about.how.image.src}
          alt={about.how.image.alt}
          fill
          sizes="(max-width: 1260px) 100vw, 1260px"
          className="object-cover"
        />
      </div>
    </section>
  );
}
