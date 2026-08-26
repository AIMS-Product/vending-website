import { describe, expect, it } from "vitest";
import type { ContentPage } from "./content-page";
import {
  getProcessStep,
  listProcessSlugs,
  processNeighbours,
  processSteps,
} from "./process";
import { getSolution, listSolutionSlugs, solutions } from "./solutions";

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
      // Media without a src falls back to a labelled frame, so alt is never
      // optional — it is the only thing a screen reader (or the placeholder)
      // has to go on.
      for (const feature of page.features) {
        expect(feature.media.alt.length).toBeGreaterThan(0);
      }
      expect(page.hero.alt.length).toBeGreaterThan(0);
    }
  });

  // A video without intrinsic dimensions falls back to a 16:9 frame, which
  // pillarboxes these 1700x1080 screen recordings with black bars.
  it("gives every video its intrinsic width and height", () => {
    const media = registry.pages.flatMap((page) => [
      page.hero,
      ...page.features.map((feature) => feature.media),
    ]);
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
