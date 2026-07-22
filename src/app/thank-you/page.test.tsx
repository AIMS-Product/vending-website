import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ThankYouPage from "./page";
import { THANK_YOU_STATES } from "@/lib/qualification/scoring";

async function renderPage(searchParams: Record<string, string>) {
  const page = await ThankYouPage({
    searchParams: Promise.resolve(searchParams),
  });
  // React escapes apostrophes as HTML entities in static markup; decode the
  // one entity our copy actually uses so assertions can compare plain text.
  return renderToStaticMarkup(page).replaceAll("&#x27;", "'");
}

describe("ThankYouPage", () => {
  it.each([
    ["not_right_time"] as const,
    ["good_potential"] as const,
    ["strong_fit"] as const,
    ["perfect_fit"] as const,
  ])("renders the %s state's headline and CTA", async (stateKey) => {
    const html = await renderPage({ state: stateKey });
    const state = THANK_YOU_STATES[stateKey];

    expect(html).toContain(state.headline);
    expect(html).toContain(state.cta);
  });

  it("falls back to good_potential when state is missing", async () => {
    const html = await renderPage({});
    expect(html).toContain(THANK_YOU_STATES.good_potential.headline);
  });

  it("falls back to good_potential when state is invalid", async () => {
    const html = await renderPage({ state: "not_a_real_state" });
    expect(html).toContain(THANK_YOU_STATES.good_potential.headline);
  });

  it("renders no secondary CTA for any state", async () => {
    // The 90-Day Guide asset doesn't exist yet, so not_right_time books the
    // readiness call as its single CTA — no state defines secondary copy.
    for (const stateKey of [
      "not_right_time",
      "good_potential",
      "strong_fit",
      "perfect_fit",
    ] as const) {
      expect(THANK_YOU_STATES[stateKey].secondaryCta).toBeUndefined();
    }
  });

  it("carries an optional score through as a hidden debug value", async () => {
    const html = await renderPage({ state: "perfect_fit", score: "92" });
    expect(html).toContain("92");
  });
});
