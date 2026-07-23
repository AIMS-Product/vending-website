import Image from "next/image";
import { applyMembers } from "@/lib/content/apply-page";

// "Regular people who ran the system" — three full success-story cards
// (finished graphics from Kody) shown 3-across on desktop, stacked on mobile.
// Each card is a link to that member's story on YouTube (Kody: onsite case
// studies later; the YouTube videos for now). The card art carries all the copy;
// each link's aria-label + the image alt make the story available to screen
// readers, and the play badge signals the card opens a video.
export function ApplyMembers() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 py-24 lg:px-10">
      <p className="text-center text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
        {applyMembers.eyebrow}
      </p>
      <h2 className="mt-4 text-center text-[clamp(2rem,3.4vw,2.9rem)] leading-[1.05] font-black text-[#111111] uppercase">
        {applyMembers.title}
      </h2>

      <ul className="mt-12 grid gap-7 md:grid-cols-3">
        {applyMembers.cards.map((card) => (
          <li key={card.name} className="min-w-0">
            <a
              href={card.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${card.name} — watch the story on YouTube`}
              className="group relative block overflow-hidden rounded-[16px] transition duration-200 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Image
                src={card.image}
                alt={card.alt}
                width={880}
                height={1500}
                sizes="(min-width: 768px) 360px, 100vw"
                className="h-auto w-full"
              />
              {/* Play badge — signals the card opens a video, brightens on hover. */}
              <span
                aria-hidden
                className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full border-2 border-white bg-[#111111]/70 text-white shadow-[3px_3px_0_rgba(0,0,0,0.25)] backdrop-blur-sm transition group-hover:bg-[#f47b3b] group-hover:text-[#111111]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="ml-0.5 size-5"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </a>
            <p className="mt-3 text-center text-sm font-black tracking-wide text-[#066a99] uppercase">
              <a
                href={card.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#111111] focus-visible:underline focus-visible:outline-none"
              >
                Watch {card.name.split(" ")[0]}&rsquo;s story
              </a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
