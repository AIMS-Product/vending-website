import { about } from "@/lib/content/about";
import { Section } from "@/components/ui/Section";

// The founder story reads as an article: left-aligned at prose width. It was
// centred paragraphs in a 900px column, followed by a 1,300px portrait band
// that repeated the hero (the portrait now lives only in AboutHero).
export function AboutHow() {
  return (
    <Section width="article">
      <h2 className="text-ink text-4xl leading-tight font-black uppercase sm:text-5xl">
        {about.how.title.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h2>

      <div className="mt-10 space-y-6 text-lg leading-8 font-semibold text-slate-700">
        {about.how.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </Section>
  );
}
