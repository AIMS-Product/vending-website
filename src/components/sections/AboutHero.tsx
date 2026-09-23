import Image from "next/image";
import { about } from "@/lib/content/about";
import { Container } from "@/components/ui/Container";

// Two columns from md: on a tablet the single column left the copy capped
// at ~530px over an 728px-tall square portrait.
export function AboutHero() {
  return (
    <section className="border-ink relative isolate overflow-hidden border-b-2 bg-[#f5fbff] pt-28 pb-20 lg:pt-32 lg:pb-28">
      <Container className="grid items-center gap-12 md:grid-cols-2 lg:gap-16">
        <div className="flex flex-col justify-center">
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            {about.hero.eyebrow}
          </p>
          <h1 className="text-ink mt-5 text-[clamp(3rem,6vw,5.8rem)] leading-[0.95] font-black uppercase">
            {about.hero.title}
          </h1>

          <div className="mt-8 max-w-xl space-y-5 text-lg leading-8 font-semibold text-slate-700 lg:text-xl">
            {about.hero.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>

        <div className="border-ink rounded-card shadow-card relative aspect-square w-full overflow-hidden border-2 bg-white">
          <Image
            src={about.hero.image.src}
            alt={about.hero.image.alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            className="object-cover object-top"
          />
        </div>
      </Container>
    </section>
  );
}
