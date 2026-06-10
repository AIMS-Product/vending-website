import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = "http://localhost:3001";
const PAGE_ID = process.argv[2] || "e44f0fc3-0dcf-480f-9c99-f3409c690378";
const URL = `${BASE}/admin/pages/${PAGE_ID}`;
const SHOT = "plans/seo-builder-ux-fixes/agent-runs/n8-screens/editor-canvas.png";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
// Block chrome (the BlockToolbar header) is rendered in the DOM but kept at
// opacity-0 until hover/focus on desktop. It is present for axe regardless.
await page.waitForTimeout(1500);

// Full axe scan.
const results = await new AxeBuilder({ page }).analyze();
const prohibited = results.violations.filter((v) => v.id === "aria-prohibited-attr");
const prohibitedNodes = prohibited.flatMap((v) =>
  v.nodes.map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 160) })),
);

// Confirm block names still resolve in the accessibility tree.
const blockChromeNames = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('[role="img"][aria-label]').forEach((el) => {
    const label = el.getAttribute("aria-label") || "";
    if (/\bblock\b/i.test(label) || /^(Ready|Needs|Draft|Incomplete)/i.test(label)) {
      out.push({ tag: el.tagName.toLowerCase(), role: el.getAttribute("role"), label });
    }
  });
  return out.slice(0, 20);
});

await page.screenshot({ path: SHOT });

console.log(JSON.stringify({
  url: URL,
  allViolations: results.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length })),
  totalViolations: results.violations.length,
  ariaProhibitedCount: prohibited.reduce((a, v) => a + v.nodes.length, 0),
  ariaProhibitedNodes: prohibitedNodes,
  blockChromeNamesResolved: blockChromeNames,
}, null, 2));

await browser.close();
