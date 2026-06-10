import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const BASE = process.env.N17_BASE_URL ?? "http://localhost:3001";
const REV_PAGE_ID = process.env.N17_PAGE_ID; // a page with revisions
const PHASE = process.env.N17_PHASE ?? "before";
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n17-screens");

const log = (...a) => console.log(`[n17:${PHASE}]`, ...a);
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${PHASE}-${name}.png`), fullPage: true }).catch(() => {});
}

async function axe(page, label) {
  const res = await new AxeBuilder({ page }).analyze();
  const v = res.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length }));
  const landmark = v.filter((x) => x.id.startsWith("landmark"));
  const target = v.filter((x) => x.id === "target-size");
  const focus = v.filter((x) => /focus|outline/.test(x.id));
  log(`AXE ${label}: total=${v.length} :: ${v.map((x) => `${x.id}(${x.impact})x${x.n}`).join(", ") || "clean"}`);
  if (landmark.length) log(`  landmark: ${landmark.map((x) => x.id).join(", ")}`);
  if (target.length) log(`  target-size: x${target[0].n}`);
  if (focus.length) log(`  focus: ${focus.map((x) => x.id).join(", ")}`);
  return { all: v, landmark, target, focus };
}

async function openEditor(page) {
  await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Blog page" }).click();
  await page.getByRole("button", { name: "Start building page" }).click();
  await page.locator("#page-title-field").waitFor({ state: "visible", timeout: 10000 });
}

// Tab from the top of the document and report the stop index at which the first
// SEO field (#page-title-field) receives focus.
async function seoFieldTabStop(page) {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  await page.locator("body").click({ position: { x: 2, y: 2 } }).catch(() => {});
  for (let i = 1; i <= 60; i++) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate(() => document.activeElement?.id || "");
    if (id === "page-title-field") return i;
  }
  return -1;
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addInitScript(() => {
    try { window.localStorage.setItem("page-builder-editor-walkthrough-seen", "1"); } catch {}
  });
  const page = await context.newPage();

  try {
    // Editor: axe + SEO-field tab stop.
    await openEditor(page);
    await axe(page, "editor");
    const stop = await seoFieldTabStop(page);
    log(`SEO first field (#page-title-field) reached at TAB STOP: ${stop === -1 ? "NOT within 60" : stop}`);
    await shot(page, "editor");

    // Item 5: measure the smallest interactive hit target in the canvas chrome
    // (hover a column to reveal move/more controls). Report any < 24px.
    const smallest = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll('button, a[href], [role="button"], summary'),
      );
      let min = Infinity;
      let what = "";
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue; // hidden
        const side = Math.min(r.width, r.height);
        if (side < min) {
          min = side;
          what = (el.getAttribute("aria-label") || el.textContent || el.tagName).slice(0, 40);
        }
      }
      return { min: Math.round(min), what };
    });
    log(`Canvas/editor smallest visible interactive target: ${smallest.min}px (${smallest.what})`);

    // Pages list: axe (archive cue + targets).
    await page.goto(`${BASE}/admin/pages`, { waitUntil: "networkidle" });
    await axe(page, "pages-list");
    await shot(page, "pages-list");

    // Revision page (editor with history panel): axe (dup main / nested aside).
    if (REV_PAGE_ID) {
      await page.goto(`${BASE}/admin/pages/${REV_PAGE_ID}`, { waitUntil: "networkidle" });
      await axe(page, "revision-editor");
      await shot(page, "revision-editor");
    }
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(`[n17:${PHASE}] script error`, e);
  process.exit(2);
});
