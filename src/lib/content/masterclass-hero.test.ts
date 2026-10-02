import { describe, expect, it } from "vitest";
import { heroForAngle, masterclassHero } from "@/lib/content/masterclass";

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
});
