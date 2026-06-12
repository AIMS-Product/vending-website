import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const pageId = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(`http://localhost:3001/admin/pages/${pageId}`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const results = await new AxeBuilder({ page }).analyze();
const byImpact = {};
for (const v of results.violations) {
  byImpact[v.impact] = byImpact[v.impact] || [];
  byImpact[v.impact].push(v.id);
}
console.log(JSON.stringify({ serious: byImpact.serious ?? [], critical: byImpact.critical ?? [], moderate: byImpact.moderate ?? [] }));
await browser.close();
