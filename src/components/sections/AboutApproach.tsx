import Image from "next/image";
import { about } from "@/lib/content/about";

export function AboutApproach() {
  return (
    <section className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-lg">
          <Image
            src={about.approach.image.src}
            alt={about.approach.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        <div>
          <h2 className="text-brand-500 text-4xl font-semibold tracking-tight sm:text-5xl">
            {about.approach.title}
          </h2>
          <div className="mt-6 max-w-md space-y-5 text-slate-600">
            {about.approach.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
