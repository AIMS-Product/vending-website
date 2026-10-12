import { describe, expect, it } from "vitest";
import { applyHero } from "@/lib/content/apply-page";
import { legacyLeadRoutes } from "@/lib/content/legacy-routes";
import { splitMoneyPhrase } from "./ApplyHero";

// The highlight splits Kody's wording for presentation only: joining the
// parts back must give the exact headline, character for character.
describe("splitMoneyPhrase", () => {
  it("highlights a money phrase exactly as before", () => {
    // The funnel headline no longer carries income (Google Ads "Unreliable
    // claims"), but the splitter still serves the legacy lead pages.
    const headline =
      "Everyday People Are Building $5-$60k/Month Vending Routes";
    const parts = splitMoneyPhrase(headline);
    expect(parts?.money).toBe("$5-$60k/Month");
    expect(`${parts?.before}${parts?.money}${parts?.after}`).toBe(headline);
  });

  it("keeps income figures out of the funnel hero", () => {
    expect(splitMoneyPhrase(applyHero.headline)).toBeNull();
    expect(applyHero.headline).toContain(applyHero.highlight);
  });

  it("finds the legacy pages' phrasing and never rewrites a title", () => {
    const advisory = legacyLeadRoutes.find((route) =>
      route.pageTitle.includes("Per Month"),
    );
    const parts = splitMoneyPhrase(advisory?.pageTitle ?? "");
    expect(parts?.money).toBe("$5k-$60k Per Month");
    for (const route of legacyLeadRoutes) {
      const split = splitMoneyPhrase(route.pageTitle);
      if (split) {
        expect(`${split.before}${split.money}${split.after}`).toBe(
          route.pageTitle,
        );
      }
    }
  });

  it("leaves a headline with no money phrase alone", () => {
    expect(splitMoneyPhrase("Your Market May Still Be Open.")).toBeNull();
  });
});
