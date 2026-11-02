import Link from "next/link";
import { Container } from "@/components/ui/Container";
import type { ReadingLink } from "@/lib/news/related-reading";

export function NewsKeepReading({ links }: { links: readonly ReadingLink[] }) {
  if (links.length === 0) return null;

  return (
    <section
      aria-labelledby="keep-reading-heading"
      className="border-ink border-t-2 bg-white py-16"
    >
      <Container>
        <h2
          id="keep-reading-heading"
          className="text-ink text-3xl leading-tight font-black uppercase sm:text-4xl"
        >
          Keep reading
        </h2>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-card border-ink shadow-card hover:shadow-card-hover focus-visible:ring-sky text-ink flex h-full border-2 bg-white p-6 text-xl leading-tight font-black uppercase transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {link.title}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
