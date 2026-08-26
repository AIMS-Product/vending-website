import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentJourney } from "./ContentJourney";
import { solutions } from "@/lib/content/solutions";
import { processSteps } from "@/lib/content/process";

/**
 * The rail is a set of plain in-page anchors, so the failure mode is a dead
 * link: a chip pointing at an id nothing renders scrolls nowhere and reports
 * no error. These assertions run against the server-rendered markup, which is
 * also the no-JavaScript rendering — the scroll-spy is an enhancement, and
 * everything asserted here has to hold before it runs.
 */
const markup = (page: (typeof solutions)[number]) =>
  renderToStaticMarkup(
    <ContentJourney
      thesis={page.thesis}
      steps={page.steps}
      features={page.features}
    />,
  );

const allPages = [...solutions, ...processSteps];

describe("ContentJourney", () => {
  it("renders the anchor the hero CTA links to", () => {
    // `content-pages.test.ts` only allows records to link to `#how-it-works`.
    // This is the other half of that contract: the template emits it.
    expect(markup(solutions[0])).toContain('id="how-it-works"');
  });

  it.each(allPages.map((page) => [page.slug, page] as const))(
    "%s: every rail chip lands on a block that exists",
    (_slug, page) => {
      const html = markup(page);
      const targets = [...html.matchAll(/href="#(step-\d+)"/g)].map(
        (match) => match[1],
      );

      expect(targets.length).toBe(
        Math.min(page.steps.length, page.features.length),
      );
      for (const target of targets) {
        expect(html).toContain(`id="${target}"`);
      }
    },
  );

  it.each(allPages.map((page) => [page.slug, page] as const))(
    "%s: pairs every step with a feature block",
    (_slug, page) => {
      // The merged section pairs step N to feature N. A record whose two lists
      // drift apart would silently drop the extras.
      expect(page.steps.length).toBe(page.features.length);
    },
  );

  it("strips the number a step label carries so the rail never doubles it", () => {
    const html = renderToStaticMarkup(
      <ContentJourney
        thesis="Thesis"
        steps={[{ label: "01 · Find", title: "Ranked locations", body: "b" }]}
        features={[
          { eyebrow: "Find", title: "Title", body: "Body", points: ["Point"] },
        ]}
      />,
    );
    // The rail draws the numeral in its own badge, so the label contributes
    // the name only.
    expect(html).toContain("Find");
    expect(html).not.toContain("01 ·");
  });

  it("keeps the heading order flat: one h2 per block, no skipped level", () => {
    const html = markup(solutions[0]);
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) =>
      Number(m[1]),
    );
    expect(levels.length).toBeGreaterThan(0);
    // The page h1 lives in the hero; this section starts at h2 and stays there,
    // so it can never produce an axe `heading-order` jump.
    expect(new Set(levels)).toEqual(new Set([2]));
  });
});
