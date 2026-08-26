import { describe, expect, it } from "vitest";
import type { ContentPage } from "./content-page";
import {
  getProcessStep,
  listIndexableProcessSlugs,
  listProcessSlugs,
  processNeighbours,
  processSectionIsHeldBack,
  processSteps,
} from "./process";
import {
  getSolution,
  listIndexableSolutionSlugs,
  listSolutionSlugs,
  solutions,
} from "./solutions";

/**
 * Both registries feed the same template, so the structural guards run over
 * both. Registry-specific rules (process ordering, prefix links) follow.
 */
const registries: ReadonlyArray<{
  name: string;
  prefix: string;
  pages: ReadonlyArray<ContentPage>;
  slugs: ReadonlyArray<string>;
  get: (slug: string) => ContentPage | undefined;
}> = [
  {
    name: "solutions",
    prefix: "/solutions",
    pages: solutions,
    slugs: listSolutionSlugs(),
    get: getSolution,
  },
  {
    name: "process",
    prefix: "/process",
    pages: processSteps,
    slugs: listProcessSlugs(),
    get: getProcessStep,
  },
];

// Every internal /solutions/* or /process/* link on any page has to land on a
// page that exists — these registries cross-link heavily, and a typo'd slug
// is a 404 the build will not complain about.
/**
 * Every `id` the shared template puts in the document that a record is allowed
 * to link to. `how-it-works` is the journey section in `ContentJourney`; the
 * per-step `step-N` ids are generated, not authored, so they are not offered
 * here. Keep in step with the template.
 */
const TEMPLATE_ANCHORS = ["#how-it-works"];

const knownPaths = new Set(
  registries.flatMap((registry) =>
    registry.slugs.map((slug) => `${registry.prefix}/${slug}`),
  ),
);

describe.each(registries)("$name content", (registry) => {
  it("has unique, url-safe slugs", () => {
    expect(new Set(registry.slugs).size).toBe(registry.slugs.length);
    for (const slug of registry.slugs)
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("resolves every slug and rejects unknown ones", () => {
    for (const slug of registry.slugs) {
      expect(registry.get(slug)?.slug).toBe(slug);
    }
    expect(registry.get("not-a-page")).toBeUndefined();
  });

  it("gives every page the parts the template needs", () => {
    for (const page of registry.pages) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.intro.length).toBeGreaterThan(0);
      expect(page.thesis.length).toBeGreaterThan(0);
      expect(page.steps.length).toBeGreaterThan(0);
      expect(page.features.length).toBeGreaterThan(0);
      expect(page.ctas.length).toBeGreaterThan(0);
      expect(page.closing.ctas.length).toBeGreaterThan(0);
      expect(page.parent.href.startsWith("/")).toBe(true);
      expect(page.parent.label.length).toBeGreaterThan(0);
      // Media is optional — most blocks carry no visual by design. When one
      // IS present, alt is not optional: it is the only thing a screen reader
      // (or the empty-frame fallback) has to go on.
      for (const feature of page.features) {
        if (feature.media) expect(feature.media.alt.length).toBeGreaterThan(0);
        for (const stat of feature.stats ?? []) {
          expect(stat.value.length).toBeGreaterThan(0);
          expect(stat.label.length).toBeGreaterThan(0);
        }
      }
      if (page.hero) expect(page.hero.alt.length).toBeGreaterThan(0);
    }
  });

  // A video without intrinsic dimensions falls back to a 16:9 frame, which
  // pillarboxes these 1700x1080 screen recordings with black bars.
  it("gives every video its intrinsic width and height", () => {
    const media = registry.pages
      .flatMap((page) => [page.hero, ...page.features.map((f) => f.media)])
      .filter((entry) => entry !== undefined);
    for (const item of media.filter((entry) => entry.video)) {
      expect(item.width).toBeGreaterThan(0);
      expect(item.height).toBeGreaterThan(0);
      expect(item.poster).toBeTruthy();
    }
  });

  it("keeps every internal link relative to this site, and real", () => {
    for (const page of registry.pages) {
      const hrefs = [
        ...page.ctas.map((cta) => cta.href),
        ...page.closing.ctas.map((cta) => cta.href),
        ...page.related.map((item) => item.href),
      ];
      for (const href of hrefs) {
        // An in-page anchor is the third legal shape, alongside a site-relative
        // path and an absolute https URL. Only the ids the template actually
        // renders are allowed: a `#`-link to an id nothing emits is a dead CTA
        // that no 404 check would ever catch.
        if (href.startsWith("#")) {
          expect(TEMPLATE_ANCHORS).toContain(href);
          continue;
        }
        expect(href.startsWith("/") || href.startsWith("https://")).toBe(true);
        // /apply 301s to /contact, so linking it costs a redirect hop.
        expect(href.startsWith("/apply")).toBe(false);
        if (/^\/(solutions|process)\/./.test(href)) {
          expect(knownPaths.has(href)).toBe(true);
        }
      }
    }
  });
});

describe("process ordering", () => {
  it("gives every step a card-length blurb", () => {
    for (const step of processSteps) {
      expect(step.blurb.length).toBeGreaterThan(0);
      expect(step.blurb.length).toBeLessThan(160);
    }
  });

  it("links each step to its neighbours and no further", () => {
    const [first] = processSteps;
    const last = processSteps[processSteps.length - 1];
    expect(processNeighbours(first.slug)).toHaveLength(1);
    expect(processNeighbours(last.slug)).toHaveLength(1);
    for (const step of processSteps.slice(1, -1)) {
      expect(processNeighbours(step.slug)).toHaveLength(2);
    }
    expect(processNeighbours("not-a-step")).toHaveLength(0);
  });

  it("numbers the eyebrows in registry order", () => {
    processSteps.forEach((step, index) => {
      expect(step.eyebrow).toBe(`Step ${String(index + 1).padStart(2, "0")}`);
    });
  });
});

describe("search hold-back", () => {
  // /solutions/vendscout shipped to production and is already indexed.
  // Flagging it would retract a live page from search, which is a very
  // different act from holding an unpublished one back.
  it("leaves the already-published solution page indexable", () => {
    expect(getSolution("vendscout")?.noindex).toBeUndefined();
    expect(listIndexableSolutionSlugs()).toContain("vendscout");
  });

  it("keeps held-back pages out of the sitemap", () => {
    for (const page of [...solutions, ...processSteps]) {
      const list = page.slug.startsWith("vendscout")
        ? listIndexableSolutionSlugs()
        : solutions.includes(page)
          ? listIndexableSolutionSlugs()
          : listIndexableProcessSlugs();
      expect(list.includes(page.slug)).toBe(!page.noindex);
    }
  });

  // The index must never outlive its children in search: a published index
  // listing seven noindexed pages is a crawl dead end.
  it("holds the process index back exactly while its steps are", () => {
    expect(processSectionIsHeldBack).toBe(
      processSteps.every((step) => step.noindex),
    );
  });
});
