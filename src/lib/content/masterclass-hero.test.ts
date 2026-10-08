import { describe, expect, it } from "vitest";
import {
  angleTerm,
  withAngleTerm,
  heroForAngle,
  masterclassHero,
  masterclassHeroAngles,
  masterclassTakeaways,
  pageForAngle,
} from "@/lib/content/masterclass";

describe("heroForAngle", () => {
  it("swaps only the headline copy for a known angle", () => {
    const hero = heroForAngle("location");
    expect(hero.headline).toBe("Don't buy the vending machine yet.");
    expect(hero.headline).toContain(hero.highlight);
    expect(hero.formHeading).toBe(masterclassHero.formHeading);
  });

  it("falls back to the default for missing, unknown or prototype keys", () => {
    for (const angle of [undefined, "", "nope", "toString", "__proto__"]) {
      expect(heroForAngle(angle)).toBe(masterclassHero);
    }
  });

  it("every angle's highlight sits inside its headline, so the sweep renders", () => {
    for (const angle of Object.keys(masterclassHeroAngles)) {
      const hero = heroForAngle(angle);
      expect(hero.headline, angle).toContain(hero.highlight);
    }
  });
});

describe("pageForAngle (GHL /v1, /v3, /v5 message sets)", () => {
  it("the default page and headline-only angles keep the default message", () => {
    for (const angle of [undefined, "nope", "capital", "location"]) {
      const page = pageForAngle(angle);
      expect(page.intro).toBeNull();
      expect(page.takeaways).toBe(masterclassTakeaways);
    }
  });

  it("v1, v3 and v5 each carry their own intro, bullets and both fit lists", () => {
    const pages = ["v1", "v3", "v5"].map((a) => pageForAngle(a));
    for (const page of pages) {
      expect(page.intro).toBeTruthy();
      expect(page.takeaways).not.toBe(masterclassTakeaways);
      expect(page.fitFor.length).toBeGreaterThanOrEqual(4);
      expect(page.notFitFor.length).toBeGreaterThanOrEqual(4);
    }
    // Three different messages, not one list reused.
    expect(new Set(pages.map((p) => p.takeaways[0])).size).toBe(3);
  });

  it("matches the GHL pages verbatim where they are distinctive", () => {
    expect(heroForAngle("v1").headline).toBe("Your capital should have a job");
    expect(heroForAngle("v5").headline).toBe(
      "A strong income can still depend on one source.",
    );
    expect(pageForAngle("v3").fitFor).toContain(
      "You want your kids to see business ownership up close",
    );
  });
});

describe("angleTerm", () => {
  it("names the version for GHL's utm_term, and nothing for the default page", () => {
    expect(angleTerm("v1")).toBe("angle-v1");
    expect(angleTerm("capital")).toBe("angle-capital");
    expect(angleTerm(undefined)).toBeNull();
    expect(angleTerm("__proto__")).toBeNull();
  });
});

describe("withAngleTerm", () => {
  it("overrides the utm_term Meta appends to every ad click", () => {
    const fromMeta = { utm_source: "meta", utm_medium: "120247650598250338", utm_term: "120247650598250338" };
    expect(withAngleTerm(fromMeta, "v3")).toEqual({ ...fromMeta, utm_term: "angle-v3" });
  });
  it("leaves attribution untouched without a known angle", () => {
    const fromUrl = { utm_term: "kept" };
    expect(withAngleTerm(fromUrl, undefined)).toBe(fromUrl);
    expect(withAngleTerm(fromUrl, "nope")).toBe(fromUrl);
  });
});
