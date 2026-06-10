import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001";
const OUT = path.resolve("plans/ux-verified-technical-fixes/agent-runs");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const log = [];

try {
  await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  log.push(`landed url: ${page.url()}`);
  await page.screenshot({ path: path.join(SHOTS, "s16-a-pages-new.png"), fullPage: true });

  // Count landmarks for context
  const landmarks = await page.evaluate(() => {
    const roleEls = Array.from(document.querySelectorAll(
      'main,nav,header,footer,aside,form,section[aria-label],section[aria-labelledby],[role="main"],[role="navigation"],[role="banner"],[role="contentinfo"],[role="complementary"],[role="region"],[role="search"],[role="form"]'
    ));
    return roleEls.map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || "(implicit)",
      label: el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || "",
    }));
  });
  log.push(`landmark elements (${landmarks.length}): ${JSON.stringify(landmarks, null, 2)}`);

  const results = await new AxeBuilder({ page }).analyze();
  fs.writeFileSync(path.join(OUT, "s16-axe-pages-new.json"), JSON.stringify(results, null, 2));

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));
  log.push(`axe total violations: ${results.violations.length}`);
  log.push(`violation ids: ${JSON.stringify(results.violations.map((v) => v.id))}`);
  const lu = results.violations.find((v) => v.id === "landmark-unique");
  log.push(`landmark-unique present: ${lu ? "YES" : "NO"}`);
  if (lu) log.push(`landmark-unique detail: ${JSON.stringify({ impact: lu.impact, nodes: lu.nodes.map((n) => n.target.join(" ")) }, null, 2)}`);
  log.push(`all violations: ${JSON.stringify(violations, null, 2)}`);
} catch (e) {
  log.push(`ERROR: ${String(e)}`);
  await page.screenshot({ path: path.join(SHOTS, "s16-a-error.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  console.log(log.join("\n"));
}
