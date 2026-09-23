import { describe, expect, it } from "vitest";
import { applyHero } from "@/lib/content/apply-page";
import { legacyLeadRoutes } from "@/lib/content/legacy-routes";
import { splitMoneyPhrase } from "./ApplyHero";

// The highlight splits Kody's wording for presentation only: joining the
// parts back must give the exact headline, character for character.
describe("splitMoneyPhrase", () => {
  it("highlights the funnel claim exactly as before", () => {
    const parts = splitMoneyPhrase(applyHero.headline);
    expect(parts?.money).toBe("$5-$60k/Month");
    expect(`${parts?.before}${parts?.money}${parts?.after}`).toBe(
      applyHero.headline,
    );
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
