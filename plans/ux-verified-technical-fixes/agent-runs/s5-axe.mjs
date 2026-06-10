// S5 axe runner — landmark-complementary-is-top-level on a news article + /admin/news/new.
// Usage: node s5-axe.mjs <label>   (writes s5-axe-<label>.json next to this file)
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "run";
const BASE = "http://localhost:3001";
const TARGETS = [
  { name: "article", url: `${BASE}/news/how-to-choose-the-perfect-location-for-vending-machine` },
  { name: "admin-news-new", url: `${BASE}/admin/news/new` },
];

const browser = await chromium.launch();
const context = await browser.newContext();
const out = {};
for (const t of TARGETS) {
  const page = await context.newPage();
  await page.goto(t.url, { waitUntil: "networkidle" });
  const results = await new AxeBuilder({ page })
    .withRules(["landmark-complementary-is-top-level"])
    .analyze();
  out[t.name] = {
    url: t.url,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target, html: n.html })),
    })),
    violationCount: results.violations.length,
  };
  await page.close();
}
await browser.close();
const file = path.join(__dirname, `s5-axe-${label}.json`);
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`wrote ${file}`);
for (const [name, r] of Object.entries(out)) {
  console.log(`${name}: ${r.violationCount} landmark-complementary violation(s)`);
}
