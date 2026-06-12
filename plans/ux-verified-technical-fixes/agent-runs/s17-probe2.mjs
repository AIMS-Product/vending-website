import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const SHOTS =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs/shots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /start building page/i }).click();
await page.waitForTimeout(1500);

// Try the readiness deep-link for the page title.
const titleCta = page.getByRole("button", { name: /Add a page title/i });
console.log("title CTA count:", await titleCta.count());
await titleCta.first().click().catch((e) => console.log("click err", e.message));
await page.waitForTimeout(1200);

const tf = page.locator("#page-title-field");
console.log("title field visible after deep-link:", await tf.isVisible().catch(() => false));
const box = await tf.boundingBox().catch(() => null);
console.log("title field box:", JSON.stringify(box));

// also report the SEO toggle button & whether panel expanded
const seoBtns = await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .filter((b) => /seo/i.test(b.getAttribute("aria-label") || "") || b.textContent?.trim() === "SEO")
    .map((b) => ({ label: b.getAttribute("aria-label"), text: b.textContent?.trim(), expanded: b.getAttribute("aria-expanded") })),
);
console.log("SEO toggles:", JSON.stringify(seoBtns));
await page.screenshot({ path: `${SHOTS}/s17-probe2.png`, fullPage: true });
await browser.close();
