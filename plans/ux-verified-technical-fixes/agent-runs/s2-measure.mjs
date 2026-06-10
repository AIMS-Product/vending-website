// S2 tap-target measurement for public Header nav + Footer links.
// Measures boundingBox heights of nav/footer links at mobile (375) and
// desktop (1280) viewports, and captures screenshots for visual diff.
// Usage: node s2-measure.mjs <label>   (label e.g. "before" | "after")
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "run";
const BASE = "http://localhost:3000";
const shotsDir = path.join(__dirname, "shots");
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await chromium.launch();

async function linkBoxes(page, selector) {
  const handles = await page.$$(selector);
  const out = [];
  for (const h of handles) {
    const text = (await h.innerText()).trim();
    const box = await h.boundingBox();
    if (box) out.push({ text, height: Math.round(box.height * 100) / 100 });
  }
  return out;
}

const results = { label, baseUrl: BASE, desktop: {}, mobile: {} };

// --- Desktop 1280 ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/about`, { waitUntil: "networkidle" });
  const header = await page.$("header");
  const headerBox = await header.boundingBox();
  results.desktop.headerHeight = Math.round(headerBox.height * 100) / 100;
  results.desktop.navLinks = await linkBoxes(page, 'header nav[aria-label="Primary"] a');
  results.desktop.footerLinks = await linkBoxes(page, 'footer nav[aria-label="Footer"] a');
  await page.screenshot({
    path: path.join(shotsDir, `s2-desktop-header-${label}.png`),
    clip: { x: 0, y: 0, width: 1280, height: headerBox.height },
  });
  const footer = await page.$("footer");
  const fBox = await footer.boundingBox();
  await footer.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(shotsDir, `s2-desktop-footer-${label}.png`),
    clip: { x: 0, y: 0, width: 1280, height: Math.min(fBox.height, 900) },
  });
  await page.close();
}

// --- Mobile 375 ---
{
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(`${BASE}/about`, { waitUntil: "networkidle" });
  // open mobile menu
  await page.click('header button[aria-controls="mobile-navigation"]');
  await page.waitForSelector('#mobile-navigation a', { state: "visible" });
  results.mobile.navLinks = await linkBoxes(page, '#mobile-navigation a');
  await page.screenshot({
    path: path.join(shotsDir, `s2-mobile-header-${label}.png`),
    fullPage: false,
  });
  // close menu, scroll to footer
  await page.click('header button[aria-controls="mobile-navigation"]');
  results.mobile.footerLinks = await linkBoxes(page, 'footer nav[aria-label="Footer"] a');
  const footer = await page.$("footer");
  await footer.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(shotsDir, `s2-mobile-footer-${label}.png`),
    fullPage: false,
  });
  await page.close();
}

await browser.close();

const outFile = path.join(__dirname, `s2-measure-${label}.json`);
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
console.log(`\nwrote ${outFile}`);
