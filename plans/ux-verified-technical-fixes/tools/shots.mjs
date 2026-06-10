import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3000";
const outDir =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs/shots";

const browser = await chromium.launch();
for (const [label, width, height] of [
  ["1280", 1280, 800],
  ["375", 375, 760],
]) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Hero (top of page)
  await page.screenshot({ path: `${outDir}/s1-hero-${label}.png` });
  // Footer area (scroll to bottom)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/s1-footer-${label}.png` });
  await ctx.close();
  console.log(`shots @${label} done`);
}
await browser.close();
