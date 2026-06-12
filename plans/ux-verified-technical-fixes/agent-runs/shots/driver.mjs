import { chromium } from "playwright";

const SHOTS = new URL(".", import.meta.url).pathname;
const BASE = "http://localhost:3001";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });

// --- S14: apply error summary + anchor focus (error path, stores nothing) ---
await page.goto(`${BASE}/apply`, { waitUntil: "networkidle" });
// Submit the empty form. Server validation fails -> error state -> summary.
await page.locator('button[type="submit"]').click();
// Wait for the summary alert to render and receive focus.
const summary = page.locator('[role="alert"]').first();
await summary.waitFor({ state: "visible", timeout: 15000 });
await page.waitForTimeout(400);
await page.screenshot({
  path: `${SHOTS}s14-summary.png`,
  fullPage: false,
});

// Report whether the summary is the active (focused) element.
const summaryFocused = await page.evaluate(() => {
  const active = document.activeElement;
  return active?.getAttribute("role") === "alert";
});
console.log("S14 summary focused on appearance:", summaryFocused);

// Activate the first anchor in the summary; it should focus the matching input.
const firstAnchor = summary.locator("a[href^='#lead-']").first();
const anchorHref = await firstAnchor.getAttribute("href");
await firstAnchor.click();
await page.waitForTimeout(300);
const focusedId = await page.evaluate(
  () => document.activeElement?.getAttribute("id") ?? "(none)",
);
console.log(`S14 anchor ${anchorHref} -> focused element id:`, focusedId);
// Scroll the focused field into view and screenshot it.
await page.evaluate(() =>
  document.activeElement?.scrollIntoView({ block: "center" }),
);
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}s14-anchor-focus.png`, fullPage: false });

// --- S13: privacy line near submit on apply ---
await page.goto(`${BASE}/apply`, { waitUntil: "networkidle" });
const privacy = page.getByText("We never sell your data", { exact: false });
await privacy.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}s13-privacy.png`, fullPage: false });
const privacyHref = await page
  .locator('a[href="/privacy"]')
  .first()
  .getAttribute("href");
console.log("S13 privacy link href:", privacyHref);

// --- S12: contact State (optional) label ---
await page.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
const stateLabel = page.locator('label[for="lead-state_region"]');
await stateLabel.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const stateText = (await stateLabel.textContent())?.trim();
console.log("S12 contact State label text:", JSON.stringify(stateText));
await page.screenshot({ path: `${SHOTS}s12-optional.png`, fullPage: false });

await browser.close();
console.log("DONE");
