import Link from "next/link";
import { CaseStudyCard } from "@/components/sections/CaseStudyCard";
import { Button } from "@/components/ui/Button";
import { accelerator } from "@/lib/content/home";
import { caseStudiesStripV2 } from "@/lib/content/home-v2";
import { listPublishedCaseStudies } from "@/lib/services/case-studies";

/** Four fills one row on desktop and stays a clean 2x2 on tablet. */
const HOMEPAGE_STORY_COUNT = 4;

/**
 * The real member video stories, directly under the partner ticker.
 *
 * Deliberately the SAME `CaseStudyCard` the /case-studies index uses rather
 * than a homepage-only lookalike: these cards carry the YouTube thumbnail and
 * the result in the member's own framing, which is the proof the page is
 * selling, and a restyle should land in both places at once.
 *
 * Renders nothing at all if the query fails or comes back empty. The homepage
 * is the money page: an empty band is a worse outcome than simply not having
 * the section, and `listPublishedCaseStudies` reads a table that may be
 * unreachable in a preview environment.
 */
export async function CaseStudiesStrip() {
  let caseStudies: Awaited<ReturnType<typeof listPublishedCaseStudies>> = [];
  try {
    caseStudies = await listPublishedCaseStudies({
      limit: HOMEPAGE_STORY_COUNT,
    });
  } catch (error) {
    console.warn("home: case study strip unavailable", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }

  if (!caseStudies.length) return null;

  return (
    <section
      id="success-stories"
      aria-label="Member success stories"
      className="scroll-mt-24 bg-white px-5 py-24 lg:px-10 lg:py-32"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="text-center" data-reveal>
          <p className="text-sm font-black tracking-wide text-[#066a99] uppercase">
            {caseStudiesStripV2.eyebrow}
          </p>
          <h2 className="v2-display mt-3 text-[clamp(2.6rem,4.5vw,4.5rem)] leading-[1.0] text-[#111111] uppercase">
            {caseStudiesStripV2.title}
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-relaxed text-slate-700">
            {caseStudiesStripV2.body}
          </p>
        </div>

        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {caseStudies.map((caseStudy) => (
            <li key={caseStudy.slug} data-reveal>
              <CaseStudyCard caseStudy={caseStudy} />
            </li>
          ))}
        </ul>

        <div
          className="mt-14 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          data-reveal
        >
          <Button href={accelerator.cta.href} showArrow>
            {accelerator.cta.label}
          </Button>
          <Link
            href="/case-studies"
            className="text-sm font-black tracking-wide text-[#066a99] uppercase underline decoration-2 underline-offset-4 transition hover:text-[#111111]"
          >
            {caseStudiesStripV2.allStoriesLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
