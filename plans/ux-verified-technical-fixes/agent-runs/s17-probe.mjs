// S17 probe — start a page via the create gate, then dump the editable fields
// so we can identify the "title" input that drives autosave -> page id.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SHOTS =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs/shots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
page.on("dialog", (d) => d.accept());

await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${SHOTS}/s17-probe-0-gate.png`, fullPage: true });

const buttonsBefore = await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .map((b) => b.textContent?.trim())
    .filter(Boolean),
);
console.log("buttons on gate:", JSON.stringify(buttonsBefore));

const startBtn = page.getByRole("button", { name: /start building page/i });
await startBtn.waitFor({ state: "visible", timeout: 15000 });
await startBtn.click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS}/s17-probe-1-after.png`, fullPage: true });

console.log("URL after start:", page.url());

const after = await page.evaluate(() => {
  const fields = [];
  document
    .querySelectorAll("input, textarea, [contenteditable='true']")
    .forEach((el) => {
      const r = el.getBoundingClientRect();
      fields.push({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type"),
        name: el.getAttribute("name"),
        id: el.id || null,
        ariaLabel: el.getAttribute("aria-label"),
        placeholder: el.getAttribute("placeholder"),
        visible: r.width > 0 && r.height > 0,
      });
    });
  const headings = [...document.querySelectorAll("h1,h2,h3")].map((h) =>
    h.textContent?.trim(),
  );
  const buttons = [...document.querySelectorAll("button")]
    .map((b) => b.textContent?.trim())
    .filter(Boolean)
    .slice(0, 40);
  return { fields, headings, buttons };
});
console.log("headings:", JSON.stringify(after.headings));
console.log("buttons:", JSON.stringify(after.buttons));
console.log("FIELDS:", JSON.stringify(after.fields, null, 2));

await browser.close();
