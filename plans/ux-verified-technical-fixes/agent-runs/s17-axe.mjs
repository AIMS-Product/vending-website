// S17 check 4 — fresh, final axe sample. Run axe on three representative pages,
// expecting 0 serious/critical violations each. Save full results as JSON.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs";
const ARTICLE = "how-to-choose-the-perfect-location-for-vending-machine";

const PAGES = [
  { url: `${BASE}/news/${ARTICLE}`, name: "news-article" },
  { url: `${BASE}/admin/pages/new`, name: "pages-new" },
  { url: `${BASE}/case-studies`, name: "case-studies" },
];

const browser = await chromium.launch();
const summary = {};
for (const { url, name } of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const results = await new AxeBuilder({ page }).analyze();
  const seriousCritical = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  writeFileSync(
    `${OUT}/s17-axe-${name}.json`,
    JSON.stringify(
      {
        url,
        totalViolations: results.violations.length,
        seriousOrCritical: seriousCritical.length,
        seriousCriticalIds: seriousCritical.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
        })),
        allViolationIds: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
        })),
      },
      null,
      2,
    ),
  );
  summary[name] = {
    total: results.violations.length,
    seriousCritical: seriousCritical.length,
    ids: seriousCritical.map((v) => `${v.id}(${v.impact})`),
  };
  await ctx.close();
}
console.log("RESULT " + JSON.stringify(summary, null, 2));
await browser.close();
