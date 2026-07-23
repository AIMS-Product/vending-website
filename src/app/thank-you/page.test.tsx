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

  it("defines a secondary CTA only for not_right_time", async () => {
    // not_right_time leads download the 90-Day Roadmap first, then get a
    // book-a-call subtext fallback. The three fit bands have a single CTA.
    expect(THANK_YOU_STATES.not_right_time.secondaryCta).toBeTruthy();
    for (const stateKey of [
      "good_potential",
      "strong_fit",
      "perfect_fit",
    ] as const) {
      expect(THANK_YOU_STATES[stateKey].secondaryCta).toBeUndefined();
    }
  });

  it("routes not_right_time to the roadmap download with a book-a-call subtext", async () => {
    const html = await renderPage({ state: "not_right_time" });
    // Primary CTA downloads the roadmap PDF (Kody's Drive file).
    expect(html).toContain("Download your free 90-Day Vending Roadmap");
    expect(html).toContain("drive.google.com/uc?export=download");
    expect(html).toContain("1iORHjmg_UzU3tr5EKcEBp8XIQ-8qoNSm");
    // Subtext note + a book-a-call link to the setter/quick-discovery calendar.
    expect(html).toContain("Think you're ready?");
    expect(html).toContain(
      "Book a call with our team to explore your options.",
    );
    expect(html).toContain("cvsd-wxt-cvb/vendingpreneurs-quick-discovery");
  });

  it("routes each fit band to its own Calendly destination", async () => {
    const good = await renderPage({ state: "good_potential" });
    expect(good).toContain("cvsd-wxt-cvb/vendingpreneurs-quick-discovery");

    const strong = await renderPage({ state: "strong_fit" });
    expect(strong).toContain("cxfn-hh2-h8g/vendingpreneurs-consultation");

    const perfect = await renderPage({ state: "perfect_fit" });
    expect(perfect).toContain("cvr6-cfd-zgd/vendingpreneurs-consultation-call");
  });

  it("carries an optional score through as a hidden debug value", async () => {
    const html = await renderPage({ state: "perfect_fit", score: "92" });
    expect(html).toContain("92");
  });
});
