import Link from "next/link";
import { Container } from "@/components/ui/Container";

type Guide = {
  route_path: string;
  title: string;
  meta_description: string | null;
};

// The long-form guides above the news grid. Same card language as NewsCard
// (DESIGN.md public system): ink border, sky shadow, uppercase headings.
export function NewsGuides({ guides }: { guides: ReadonlyArray<Guide> }) {
  if (guides.length === 0) return null;

  return (
    <section aria-labelledby="guides-heading" className="bg-white py-16">
      <Container>
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          Start here
        </p>
        <h2
          id="guides-heading"
          className="text-ink mt-3 text-3xl leading-tight font-black uppercase sm:text-4xl"
        >
          Guides
        </h2>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2">
          {guides.map((guide) => (
            <li key={guide.route_path}>
              <Link
                href={guide.route_path}
                className="rounded-card border-ink shadow-card hover:shadow-card-hover focus-visible:ring-sky flex h-full flex-col gap-3 border-2 bg-white p-6 transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="text-ink text-xl leading-tight font-black uppercase">
                  {guide.title}
                </span>
                {guide.meta_description ? (
                  <span className="text-base leading-7 font-semibold text-slate-700">
                    {guide.meta_description}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
