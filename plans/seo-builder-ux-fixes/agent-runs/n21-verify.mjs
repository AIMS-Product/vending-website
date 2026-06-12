import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const PAGE_ID = process.argv[2] || "e44f0fc3-0dcf-480f-9c99-f3409c690378";
const URL = `${BASE}/admin/pages/${PAGE_ID}`;
const DIR = "plans/seo-builder-ux-fixes/agent-runs/n21-screens";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);

// Trigger autosave with a content-neutral edit: type a space into a canvas
// text field, then delete it, so the saved content is unchanged but autosave
// fires and the rail "Saved automatically" hint renders.
const field = page
  .locator('textarea, input[type="text"], [contenteditable="true"]')
  .first();
let edited = false;
if (await field.isVisible().catch(() => false)) {
  await field.click();
  await page.keyboard.type(" ");
  await page.waitForTimeout(150);
  await page.keyboard.press("Backspace");
  edited = true;
}

// Wait for autosave to round-trip and the rail hint to appear.
await page.waitForTimeout(4000);

const railHint = await page
  .getByText(/Saved automatically ·/i)
  .first()
  .innerText()
  .catch(() => null);

await page.screenshot({ path: `${DIR}/rail-saved-automatically-pt.png` });

console.log(JSON.stringify({
  page: URL,
  triggeredEdit: edited,
  railHintText: railHint,
  hintIsPacificFormatted: railHint ? /\b(PDT|PST)\b/.test(railHint) : false,
  hintHasDateAndTime: railHint
    ? /[A-Z][a-z]{2}\s+\d+,\s+\d+:\d{2}\s+(AM|PM)/.test(railHint)
    : false,
}, null, 2));

await browser.close();
