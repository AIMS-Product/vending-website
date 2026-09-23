import Image from "next/image";
import { about } from "@/lib/content/about";
import { Section } from "@/components/ui/Section";

export function AboutApproach() {
  return (
    <Section
      className="border-ink border-y-2 bg-[#f5fbff]"
      innerClassName="grid items-center gap-12 md:grid-cols-2 lg:gap-20"
    >
      <div className="border-ink rounded-card shadow-card relative aspect-[4/3] w-full overflow-hidden border-2">
        <Image
          src={about.approach.image.src}
          alt={about.approach.image.alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          loading="eager"
          className="object-cover object-top"
        />
      </div>

      <div>
        <h2 className="text-ink text-4xl leading-tight font-black uppercase sm:text-5xl">
          {about.approach.title}
        </h2>
        <div className="mt-6 max-w-xl space-y-5 text-lg leading-8 font-semibold text-slate-700">
          {about.approach.paragraphs.map((p, index) => (
            <p key={`${p}-${index}`}>{p}</p>
          ))}
        </div>
      </div>
    </Section>
  );
}
