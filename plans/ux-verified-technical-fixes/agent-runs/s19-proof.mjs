// S19 proof — mobile save bar visibility + save-via-bar persistence.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, "shots");
const BASE = "http://localhost:3001";
const NEW = `${BASE}/admin/news/new`;

const browser = await chromium.launch();

// --- 375px: bar visible while title + body focused ---
const ctxM = await browser.newContext({ viewport: { width: 375, height: 812 } });
const m = await ctxM.newPage();
await m.goto(NEW, { waitUntil: "networkidle" });

async function barState(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('[aria-label="Editor actions"]');
    if (!bar) return { present: false };
    const r = bar.getBoundingClientRect();
    const visible =
      getComputedStyle(bar).display !== "none" &&
      r.bottom <= window.innerHeight + 1 &&
      r.top < window.innerHeight &&
      r.height > 0;
    const save = bar.querySelector('button[value="save"]');
    return {
      present: true,
      display: getComputedStyle(bar).display,
      position: getComputedStyle(bar).position,
      barTop: Math.round(r.top),
      barBottom: Math.round(r.bottom),
      viewportH: window.innerHeight,
      inViewport: visible,
      saveLabel: save?.textContent?.trim(),
      saveForm: save?.getAttribute("form"),
    };
  });
}

await m.locator('input[name="title"]').click();
const titleState = await barState(m);
await m.screenshot({ path: path.join(SHOTS, "s19-375-title-focus.png") });

await m.locator('textarea[name="body"]').click();
const bodyState = await barState(m);
await m.screenshot({ path: path.join(SHOTS, "s19-375-body-focus.png") });
await ctxM.close();

// --- desktop (>= lg): bar absent / display:none ---
const ctxD = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const d = await ctxD.newPage();
await d.goto(NEW, { waitUntil: "networkidle" });
const desktopState = await d.evaluate(() => {
  const bar = document.querySelector('[aria-label="Editor actions"]');
  if (!bar) return { present: false };
  return { present: true, display: getComputedStyle(bar).display };
});
await d.screenshot({ path: path.join(SHOTS, "s19-desktop.png") });
await ctxD.close();

// --- save-via-bar persistence at 375px ---
const ctxS = await browser.newContext({ viewport: { width: 375, height: 812 } });
const s = await ctxS.newPage();
await s.goto(NEW, { waitUntil: "networkidle" });
const TITLE = "uxfix-s19-throwaway";
await s.locator('input[name="title"]').fill(TITLE);
await s.locator('textarea[name="body"]').fill("S19 throwaway draft body.");
// click the Save draft button inside the fixed bar (not the aside one)
await s
  .locator('[aria-label="Editor actions"] button[value="save"]')
  .click();
await s.waitForLoadState("networkidle");
const afterUrl = s.url();
// confirmation banner text
const banner = await s
  .locator("text=/saved/i")
  .first()
  .textContent()
  .catch(() => null);
await s.screenshot({ path: path.join(SHOTS, "s19-after-save.png") });
await ctxS.close();

await browser.close();

console.log(JSON.stringify({ titleState, bodyState, desktopState, savedDraft: { title: TITLE, afterUrl, banner } }, null, 2));
