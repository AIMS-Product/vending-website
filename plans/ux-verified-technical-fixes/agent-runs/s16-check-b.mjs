import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001";
const SHOTS = path.resolve("plans/ux-verified-technical-fixes/agent-runs/shots");
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const log = [];

// Locate the "Save draft" control and report its visibility / position relative to viewport.
async function probeSave(page, label) {
  return await page.evaluate((lbl) => {
    const candidates = Array.from(document.querySelectorAll("button, a, [role='button']"));
    const matches = candidates.filter((el) => {
      const t = (el.textContent || "").trim().toLowerCase();
      return /save\s*draft|save draft|^save$|save\b/.test(t) && /save/.test(t);
    });
    const vh = window.innerHeight;
    return matches.map((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const inViewport = r.top < vh && r.bottom > 0 && r.width > 0 && r.height > 0;
      return {
        label: lbl,
        text: (el.textContent || "").trim().slice(0, 40),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        viewportHeight: vh,
        belowFold: r.top >= vh,
        aboveFold: r.bottom <= 0,
        inViewport,
        position: style.position,
        display: style.display,
        visibility: style.visibility,
      };
    });
  }, label);
}

async function runViewport(width, height, tag) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/admin/news/new`, { waitUntil: "load", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    log.push(`[${tag}] landed: ${page.url()} viewport=${width}x${height}`);

    // State 1: fresh top of page
    await page.screenshot({ path: path.join(SHOTS, `s16-b-${tag}-1-top.png`) });
    log.push(`[${tag}] save@top: ${JSON.stringify(await probeSave(page, "top"))}`);

    // State 2: focus the title field (user editing title)
    const title = page.locator("input[name='title'], #title, input[type='text']").first();
    if (await title.isVisible({ timeout: 3000 }).catch(() => false)) {
      await title.scrollIntoViewIfNeeded().catch(() => {});
      await title.focus().catch(() => {});
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, `s16-b-${tag}-2-title-focus.png`) });
      log.push(`[${tag}] save@title-focus: ${JSON.stringify(await probeSave(page, "title-focus"))}`);
    } else {
      log.push(`[${tag}] title field not found`);
    }

    // State 3: focus the body editor (scroll to body) — user editing content
    const body = page.locator("textarea, [contenteditable='true'], .ProseMirror, [data-editor], [role='textbox']").first();
    if (await body.isVisible({ timeout: 3000 }).catch(() => false)) {
      await body.scrollIntoViewIfNeeded().catch(() => {});
      await body.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, `s16-b-${tag}-3-body-focus.png`) });
      log.push(`[${tag}] save@body-focus: ${JSON.stringify(await probeSave(page, "body-focus"))}`);
    } else {
      log.push(`[${tag}] body editor not found`);
    }

    // State 4: scroll to absolute bottom of page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, `s16-b-${tag}-4-bottom.png`) });
    log.push(`[${tag}] save@bottom: ${JSON.stringify(await probeSave(page, "bottom"))}`);

    // Document/scroll geometry
    const geo = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      scrollable: document.documentElement.scrollHeight > window.innerHeight,
    }));
    log.push(`[${tag}] geometry: ${JSON.stringify(geo)}`);
  } catch (e) {
    log.push(`[${tag}] ERROR: ${String(e)}`);
    await page.screenshot({ path: path.join(SHOTS, `s16-b-${tag}-error.png`) }).catch(() => {});
  } finally {
    await ctx.close();
  }
}

try {
  await runViewport(375, 812, "375"); // mobile
  await runViewport(768, 1024, "768"); // tablet width
} finally {
  await browser.close();
  console.log(log.join("\n"));
}
