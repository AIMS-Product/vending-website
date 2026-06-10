// S6 axe runner — heading-order on /case-studies (+ / home regression check).
// Usage: node s6-axe.mjs <label>   (writes s6-axe-<label>.json next to this file)
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "run";
const BASE = "http://localhost:3001";
const TARGETS = [
  { name: "case-studies", url: `${BASE}/case-studies` },
  { name: "home", url: `${BASE}/` },
];

const browser = await chromium.launch();
const context = await browser.newContext();
const out = {};
for (const t of TARGETS) {
  const page = await context.newPage();
  await page.goto(t.url, { waitUntil: "networkidle" });

  // Targeted: heading-order only.
  const headingOnly = await new AxeBuilder({ page })
    .withRules(["heading-order"])
    .analyze();

  // Full scan to confirm no NEW violations are introduced.
  const full = await new AxeBuilder({ page }).analyze();

  // Capture the actual heading outline for evidence.
  const outline = await page.$$eval("h1,h2,h3,h4,h5,h6", (els) =>
    els.map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").trim().slice(0, 60),
      srOnly: el.className.includes("sr-only"),
    })),
  );

  out[t.name] = {
    url: t.url,
    headingOrder: {
      violationCount: headingOnly.violations.length,
      violations: headingOnly.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, html: n.html })),
      })),
    },
    fullViolations: full.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      count: v.nodes.length,
    })),
    fullViolationCount: full.violations.length,
    outline,
  };
  await page.close();
}
await browser.close();
const file = path.join(__dirname, `s6-axe-${label}.json`);
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`wrote ${file}`);
for (const [name, r] of Object.entries(out)) {
  console.log(
    `${name}: heading-order=${r.headingOrder.violationCount}, total-axe=${r.fullViolationCount}`,
  );
}
