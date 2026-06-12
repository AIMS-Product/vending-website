import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const PAGE_ID = process.argv[2] || "e44f0fc3-0dcf-480f-9c99-f3409c690378";
const DIR = "plans/seo-builder-ux-fixes/agent-runs/n18-screens";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// ---- Redirects UI: form options + row table cell ----
await page.goto(`${BASE}/admin/pages/redirects`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${DIR}/redirects.png`, fullPage: true });
const createFormOptions = await page.$$eval("select[name='statusCode'] option", (os) =>
  os.map((o) => o.textContent?.trim()),
);
const rowCells = await page.$$eval("table td", (tds) =>
  tds.map((t) => t.textContent?.trim()).filter((t) => /\(30[1278]\)/.test(t || "")),
);

// ---- Pages list filters ----
await page.goto(`${BASE}/admin/pages`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${DIR}/pages-list-filters.png` });

// ---- Editor block settings: open a block's settings to see field labels ----
await page.goto(`${BASE}/admin/pages/${PAGE_ID}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
// Open settings for the first block via the "Edit ... settings" affordance.
const settingsBtn = page.getByRole("button", { name: /settings/i }).first();
let editorLabels = [];
if (await settingsBtn.isVisible().catch(() => false)) {
  await settingsBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/block-settings.png` });
  editorLabels = await page.evaluate(() =>
    [...document.querySelectorAll("label, span")]
      .map((el) => el.textContent?.trim())
      .filter((t) => /Overline \(eyebrow\)|Call to action \(CTA\)/.test(t || "")),
  );
}

// Also scan the canvas itself for the in-place eyebrow accessible name.
const canvasOverline = await page.evaluate(() =>
  [...document.querySelectorAll('[aria-label], .sr-only')]
    .map((el) => el.getAttribute("aria-label") || el.textContent?.trim())
    .filter((t) => /Overline \(eyebrow\)/.test(t || ""))
    .slice(0, 3),
);

console.log(JSON.stringify({
  redirectCreateFormOptions: createFormOptions,
  redirectRowCellsWithWords: rowCells.slice(0, 5),
  editorSettingsLabelsFound: [...new Set(editorLabels)],
  canvasOverlineNames: [...new Set(canvasOverline)],
}, null, 2));

await browser.close();
