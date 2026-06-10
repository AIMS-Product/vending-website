import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";

const URL =
  "http://localhost:3000/news/how-to-choose-the-perfect-location-for-vending-machine";
const OUT_DIR =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
await page.goto(URL, { waitUntil: "networkidle" });

// The seeded article body has no inline anchors, so inject a representative
// link INTO the live .public-news-prose container. This exercises the real CSS
// rule (.public-news-prose a) against the actual rendered prose background,
// without modifying source. Same markup an editor would produce.
const injected = await page.evaluate(() => {
  const prose = document.querySelector(".public-news-prose");
  if (!prose) return null;
  const firstP = prose.querySelector("p") ?? prose;
  const a = document.createElement("a");
  a.href = "/news";
  a.id = "s4-probe-link";
  a.textContent = "read our full vending location guide";
  // wrap in a paragraph so it sits in body flow like a real inline link
  const p = document.createElement("p");
  p.appendChild(document.createTextNode("For more detail, "));
  p.appendChild(a);
  p.appendChild(document.createTextNode("."));
  firstP.insertAdjacentElement("afterend", p);

  const cs = getComputedStyle(a);
  // walk up to find the actual painted background behind the link
  let el = a;
  let bg = "rgba(0, 0, 0, 0)";
  while (el) {
    const b = getComputedStyle(el).backgroundColor;
    if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") {
      bg = b;
      break;
    }
    el = el.parentElement;
  }
  return {
    color: cs.color,
    textDecorationLine: cs.textDecorationLine,
    fontWeight: cs.fontWeight,
    renderedBackground: bg,
  };
});

if (!injected) {
  console.error("FAILED: .public-news-prose not found");
  await browser.close();
  process.exit(1);
}
console.log("Probe link computed style:", JSON.stringify(injected, null, 2));

// Run axe restricted to color-contrast on the whole page.
const results = await new AxeBuilder({ page })
  .withRules(["color-contrast"])
  .analyze();

// Also scope to the article prose region only — this is S4's node boundary.
// Proves the body-link fix (.public-news-prose a) is clean independent of any
// pre-existing out-of-scope contrast issues elsewhere on the page.
const proseResults = await new AxeBuilder({ page })
  .include(".public-news-prose")
  .withRules(["color-contrast"])
  .analyze();
const proseSerious = proseResults.violations.filter(
  (v) => v.impact === "serious" || v.impact === "critical",
);
console.log(
  "Prose-scoped color-contrast serious/critical:",
  proseSerious.length,
);

const serious = results.violations.filter(
  (v) => v.impact === "serious" || v.impact === "critical",
);
const summary = {
  url: URL,
  probeLink: injected,
  totalColorContrastViolations: results.violations.length,
  seriousOrCritical: serious.length,
  proseScopedSeriousOrCritical: proseSerious.length,
  violations: results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      failureSummary: n.failureSummary,
    })),
  })),
};
writeFileSync(
  `${OUT_DIR}/s4-axe-article.json`,
  JSON.stringify(summary, null, 2),
);

// Screenshot the injected body link region.
const probe = page.locator("#s4-probe-link");
await probe.scrollIntoViewIfNeeded();
const box = await probe.boundingBox();
if (box) {
  await page.screenshot({
    path: `${OUT_DIR}/shots/s4-body-link.png`,
    clip: {
      x: Math.max(0, box.x - 40),
      y: Math.max(0, box.y - 40),
      width: Math.min(900, box.width + 400),
      height: box.height + 80,
    },
  });
}
await page.screenshot({
  path: `${OUT_DIR}/shots/s4-article-full.png`,
  fullPage: false,
});

// Screenshot the dark sidebar CTA card (the .mt-5 subtitle fix).
const ctaCard = page
  .locator("aside section", { hasText: "Build your route today" })
  .first();
if (await ctaCard.count()) {
  await ctaCard.scrollIntoViewIfNeeded();
  await ctaCard.screenshot({ path: `${OUT_DIR}/shots/s4-sidebar-cta.png` });
}

console.log("Color-contrast violations (total):", results.violations.length);
console.log("Serious/critical:", serious.length);
await browser.close();
process.exit(serious.length === 0 ? 0 : 2);
