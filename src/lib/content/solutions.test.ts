import { describe, expect, it } from "vitest";
import { getSolution, listSolutionSlugs, solutions } from "./solutions";

describe("solutions content", () => {
  it("has unique, url-safe slugs", () => {
    const slugs = listSolutionSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs)
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$|^[a-z0-9]+$/);
  });

  it("resolves every slug and rejects unknown ones", () => {
    for (const slug of listSolutionSlugs()) {
      expect(getSolution(slug)?.slug).toBe(slug);
    }
    expect(getSolution("not-a-solution")).toBeUndefined();
  });

  it("gives every page the parts the template needs", () => {
    for (const solution of solutions) {
      expect(solution.title.length).toBeGreaterThan(0);
      expect(solution.intro.length).toBeGreaterThan(0);
      expect(solution.thesis.length).toBeGreaterThan(0);
      expect(solution.steps.length).toBeGreaterThan(0);
      expect(solution.features.length).toBeGreaterThan(0);
      expect(solution.ctas.length).toBeGreaterThan(0);
      expect(solution.closing.ctas.length).toBeGreaterThan(0);
      // Media without a src falls back to a labelled frame, so alt is never
      // optional — it is the only thing a screen reader (or the placeholder)
      // has to go on.
      for (const feature of solution.features) {
        expect(feature.media.alt.length).toBeGreaterThan(0);
      }
      expect(solution.hero.alt.length).toBeGreaterThan(0);
    }
  });

  // A video without intrinsic dimensions falls back to a 16:9 frame, which
  // pillarboxes these 1700x1080 screen recordings with black bars.
  it("gives every video its intrinsic width and height", () => {
    const media = solutions.flatMap((solution) => [
      solution.hero,
      ...solution.features.map((feature) => feature.media),
    ]);
    for (const item of media.filter((entry) => entry.video)) {
      expect(item.width).toBeGreaterThan(0);
      expect(item.height).toBeGreaterThan(0);
      expect(item.poster).toBeTruthy();
    }
  });

  it("keeps every internal link relative to this site", () => {
    const hrefs = solutions.flatMap((solution) => [
      ...solution.ctas.map((cta) => cta.href),
      ...solution.closing.ctas.map((cta) => cta.href),
      ...solution.related.map((item) => item.href),
    ]);
    for (const href of hrefs) {
      expect(href.startsWith("/") || href.startsWith("https://")).toBe(true);
    }
  });
});
