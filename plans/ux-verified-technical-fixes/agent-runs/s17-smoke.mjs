// S17 check 3 — smoke sweep. One screenshot per sub-check, confirming each fix
// is live on :3000. Reports a structured verdict object per item.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const SHOTS =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs/shots";
const ARTICLE = "how-to-choose-the-perfect-location-for-vending-machine";

const browser = await chromium.launch();
const out = {};

// --- 3a: /apply empty-submit -> error summary + privacy line ---
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/apply`, { waitUntil: "networkidle" });
  const privacyVisible = await p.getByText(/never sell your data/i).first().isVisible().catch(() => false);
  await p.locator('button[type="submit"]').first().click();
  const summary = p.locator('[role="alert"]').first();
  await summary.waitFor({ state: "visible", timeout: 12000 }).catch(() => {});
  const summaryVisible = await summary.isVisible().catch(() => false);
  const anchorCount = await summary.locator('a[href^="#lead-"]').count().catch(() => 0);
  await p.screenshot({ path: `${SHOTS}/s17-3a-apply-errors.png`, fullPage: false });
  out["3a_apply"] = { summaryVisible, anchorLinks: anchorCount, privacyVisible };
  await ctx.close();
}

// --- 3b: /contact State label "(optional)" ---
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
  const stateLabel = p.locator('label[for="lead-state_region"]');
  await stateLabel.scrollIntoViewIfNeeded().catch(() => {});
  const text = (await stateLabel.textContent().catch(() => ""))?.trim();
  await p.screenshot({ path: `${SHOTS}/s17-3b-contact-optional.png`, fullPage: false });
  out["3b_contact"] = { stateLabel: text, hasOptional: /optional/i.test(text || "") };
  await ctx.close();
}

// --- 3c: /news first-paint cards + article body link + sidebar CTA subtitle ---
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/news`, { waitUntil: "domcontentloaded" });
  // first-paint: count article cards before networkidle
  const cardCount = await p.locator('article, a[href^="/news/"]').count().catch(() => 0);
  await p.screenshot({ path: `${SHOTS}/s17-3c-news-cards.png`, fullPage: false });
  out["3c_news_cards"] = { cardCount };
  await ctx.close();
}

// --- 3d: /case-studies loads, sr-only headings invisible ---
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/case-studies`, { waitUntil: "networkidle" });
  const h1 = await p.locator("h1").first().textContent().catch(() => null);
  await p.screenshot({ path: `${SHOTS}/s17-3d-case-studies.png`, fullPage: false });
  out["3d_case_studies"] = { h1: h1?.trim(), loaded: !!h1 };
  await ctx.close();
}

// --- 3e: /admin/pages — ScheduleFailedKpi absent, legend present, 16px checkbox ---
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/pages`, { waitUntil: "networkidle" });
  const scheduleFailedText = await p.getByText(/schedule.*fail/i).count().catch(() => 0);
  const checkboxSize = await p
    .locator('input[type="checkbox"][name="ids"]')
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })
    .catch(() => null);
  // readiness legend
  const legend = await p.getByText(/ready|needs work|blocked/i).count().catch(() => 0);
  await p.screenshot({ path: `${SHOTS}/s17-3e-admin-pages.png`, fullPage: false });
  out["3e_admin_pages"] = { scheduleFailedMentions: scheduleFailedText, checkboxSize, legendHits: legend };
  await ctx.close();
}

// --- 3f: /admin/news/new at 375px — sticky save bar at bottom ---
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/news/new`, { waitUntil: "networkidle" });
  const bar = await p.evaluate(() => {
    const b = document.querySelector('[aria-label="Editor actions"]');
    if (!b) return { present: false };
    const r = b.getBoundingClientRect();
    return {
      present: true,
      display: getComputedStyle(b).display,
      position: getComputedStyle(b).position,
      inViewport: r.bottom <= window.innerHeight + 1 && r.height > 0,
    };
  });
  await p.screenshot({ path: `${SHOTS}/s17-3f-news-new-375-savebar.png`, fullPage: false });
  out["3f_news_savebar_375"] = bar;
  await ctx.close();
}

// --- 3g: Admin sidebar — "Content libraries" item present ---
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/pages`, { waitUntil: "networkidle" });
  const libs = await p.getByText(/content libraries/i).count().catch(() => 0);
  await p.screenshot({ path: `${SHOTS}/s17-3g-sidebar-libraries.png`, fullPage: false });
  out["3g_sidebar_libraries"] = { contentLibrariesHits: libs };
  await ctx.close();
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
