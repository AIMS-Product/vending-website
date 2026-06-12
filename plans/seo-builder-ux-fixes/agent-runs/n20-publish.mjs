import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001";
const SHOTS = "plans/seo-builder-ux-fixes/agent-runs/n20-screens";
const TS = Date.now();
const TITLE = `N20 Publish ${TS}`;
const slug = `n20-publish-${TS}`;
const publicUrl = `/resources/${slug}`;
const steps = [];

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), timeout: 15000 }).catch(() => {});
  return `${name}.png`;
}
async function step(page, action, fn) {
  const n = steps.length + 1;
  let result = "ok";
  try { const r = await fn(); if (typeof r === "string") result = r; }
  catch (e) { result = `ERROR: ${String(e.message).slice(0, 140)}`; }
  const screenshot = await shot(page, `publishB-${String(n).padStart(2, "0")}-${action}`);
  steps.push({ n, action, result, screenshot });
  return result;
}
async function openSettingsTab(page) {
  const tab = page.getByRole("tab", { name: /settings/i }).first();
  if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) { await tab.click().catch(() => {}); await page.waitForTimeout(500); return true; }
  return false;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let createdPageId = null;

await step(page, "create-page", async () => {
  await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /start building/i }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await openSettingsTab(page);
  await page.locator("#page-title-field").first().fill(TITLE);
  const sf = page.locator("#page-slug-field").first();
  if (await sf.isVisible({ timeout: 1500 }).catch(() => false)) await sf.fill(slug);
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  createdPageId = page.url().split("/").pop()?.split("?")[0] ?? null;
  return `created ${createdPageId}`;
});

await step(page, "add-hero-block", async () => {
  // Add a hero block to satisfy the CTA/hero/lead-form blocker.
  const trig = page.locator('[data-testid="block-picker-trigger"]').first();
  await trig.click();
  await page.waitForTimeout(700);
  const heroType = page.locator('[data-testid="block-picker-type"][data-block-picker-type="hero"]').first();
  if (await heroType.isVisible({ timeout: 3000 }).catch(() => false)) await heroType.click();
  await page.waitForTimeout(500);
  await page.locator('[data-block-picker-type="hero"][data-testid="block-picker-variant"]').first().click().catch(async () => {
    await page.locator('[data-testid="block-picker-variant"]').first().click();
  });
  await page.waitForTimeout(1200);
  return "hero block added";
});

await step(page, "fill-hero-heading-and-cta", async () => {
  const notes = [];
  const h = page.getByLabel(/^Heading|^Headline/).first();
  if (await h.isVisible({ timeout: 3000 }).catch(() => false)) {
    await h.fill("N20 Proof Headline for Publish");
    notes.push("heading");
  }
  // Hero CTA label on the canvas.
  const ctaLabel = page.getByLabel(/^CTA label$/i).first();
  if (await ctaLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ctaLabel.fill("Get started");
    notes.push("cta label");
  }
  await page.waitForTimeout(400);
  // Destination URL lives in the hero block settings modal.
  const settingsBtn = page.getByRole("button", { name: /settings/i }).first();
  if (await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await settingsBtn.click();
    await page.waitForTimeout(700);
    const dest = page.getByLabel(/CTA destination URL|Destination URL/i).first();
    if (await dest.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dest.fill("/apply");
      notes.push("cta destination");
    }
    const ctaLabelModal = page.getByLabel(/^CTA label$/i).first();
    if (await ctaLabelModal.isVisible({ timeout: 1500 }).catch(() => false)) {
      await ctaLabelModal.fill("Get started");
      notes.push("cta label (modal)");
    }
    // close modal
    const close = page.getByRole("button", { name: /close block settings|close/i }).first();
    if (await close.isVisible({ timeout: 1500 }).catch(() => false)) await close.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  return notes.length ? notes.join(", ") + " filled" : "no hero fields found";
});

await step(page, "fill-seo-title-and-meta", async () => {
  await openSettingsTab(page);
  const t = page.locator("#seo-title-field").first();
  if (await t.isVisible({ timeout: 3000 }).catch(() => false)) await t.fill(`${TITLE} | Vendingpreneurs`);
  const m = page.locator("#page-meta-description-field").first();
  if (await m.isVisible({ timeout: 2000 }).catch(() => false)) await m.fill("N20 proof meta description with enough length to satisfy the readiness check for this throwaway publish-journey page.");
  await page.waitForTimeout(500);
  return "seo title + meta filled";
});

await step(page, "save-draft", async () => {
  await page.getByRole("button", { name: /save draft|^save$/i }).first().click();
  await page.waitForTimeout(3000);
  return "saved";
});

await step(page, "publish-enabled-then-click", async () => {
  const pub = page.getByRole("button", { name: /^Publish( page| changes)?$/i }).first();
  const disabledAttr = await pub.getAttribute("aria-disabled").catch(() => null);
  if (disabledAttr === "true") {
    // capture remaining blockers
    const txt = await page.locator("body").innerText();
    const m = txt.match(/Before you can publish[\s\S]{0,200}/);
    throw new Error(`Publish still disabled: ${(m?.[0] || "").replace(/\n+/g, " ").slice(0, 120)}`);
  }
  await pub.click();
  await page.waitForTimeout(800);
  return "publish clicked (was enabled)";
});

await step(page, "confirm-step-appears", async () => {
  const confirm = page.getByRole("button", { name: /^confirm publish$/i }).first();
  if (!(await confirm.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no confirm step shown");
  return "confirm step shown (gated)";
});

await step(page, "confirm-publish", async () => {
  await page.getByRole("button", { name: /^confirm publish$/i }).first().click();
  await page.waitForTimeout(4000);
  const txt = await page.locator("body").innerText();
  if (!/published/i.test(txt)) throw new Error("no 'Published' success feedback");
  return "published; success feedback visible";
});

await step(page, "open-live-page-link", async () => {
  const live = page.getByRole("link", { name: /Open live page|View live page/i }).first();
  if (!(await live.isVisible({ timeout: 4000 }).catch(() => false))) throw new Error("no 'Open live page' link (orig friction)");
  const popupP = context.waitForEvent("page", { timeout: 8000 }).catch(() => null);
  await live.click();
  const popup = await popupP;
  if (popup) {
    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    await popup.waitForTimeout(1500);
    const len = (await popup.locator("body").innerText().catch(() => "")).length;
    await shot(popup, "publishB-live-tab");
    await popup.close();
    return `live tab opened (${len} chars)`;
  }
  return "live link clicked (same tab)";
});

await step(page, "verify-live-200", async () => {
  const resp = await page.goto(`${BASE}${publicUrl}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const status = resp?.status();
  const txt = await page.locator("body").innerText();
  if (status !== 200) throw new Error(`live route status ${status}`);
  return `live route ${status} (${txt.length} chars)`;
});

await step(page, "republish-needs-fresh-confirm", async () => {
  await page.goto(`${BASE}/admin/pages/${createdPageId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const pub = page.getByRole("button", { name: /^Publish( changes| page)?$/i }).first();
  if (!(await pub.isVisible({ timeout: 3000 }).catch(() => false))) return "no re-publish button visible";
  const disabled = (await pub.getAttribute("aria-disabled").catch(() => null)) === "true";
  if (disabled) return "re-publish disabled (no pending changes)";
  await pub.click();
  await page.waitForTimeout(700);
  const confirm = page.getByRole("button", { name: /^confirm publish$/i }).first();
  const fresh = await confirm.isVisible({ timeout: 2500 }).catch(() => false);
  return fresh ? "re-publish requires a FRESH confirm step" : "re-publish did NOT re-prompt confirm (ANOMALY)";
});

// CLEANUP: unpublish/archive this throwaway page.
await step(page, "cleanup-archive", async () => {
  await page.goto(`${BASE}/admin/pages?q=${encodeURIComponent(String(TS))}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  const row = page.locator("table tbody tr", { hasText: String(TS) }).first();
  if (!(await row.isVisible({ timeout: 3000 }).catch(() => false))) return "page not in active list (already removed?)";
  await row.locator("summary").first().click().catch(() => {});
  await page.waitForTimeout(400);
  // published page: may show Unpublish then Archive; try archive
  for (const name of [/archive page/i, /unpublish/i]) {
    const btn = row.getByRole("button", { name }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(500);
      const confirm = page.getByRole("button", { name: /archive|unpublish|confirm/i }).last();
      if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) { await confirm.click(); await page.waitForTimeout(2000); }
      await page.goto(`${BASE}/admin/pages?q=${encodeURIComponent(String(TS))}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      await row.locator("summary").first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }
  return "archive/unpublish attempted";
});

await step(page, "verify-cleanup", async () => {
  await page.goto(`${BASE}/admin/pages?q=${encodeURIComponent(String(TS))}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  const present = await page.locator("table tbody tr", { hasText: String(TS) }).first().isVisible({ timeout: 2000 }).catch(() => false);
  await shot(page, "publishB-cleanup-list");
  return present ? `STILL PRESENT in active list (TS ${TS})` : "no active throwaway row";
});

const result = { ts: TS, createdPageId, publicUrl, steps };
fs.writeFileSync("plans/seo-builder-ux-fixes/agent-runs/n20-publish-results.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(steps.map((s) => `${s.n}.${s.action}: ${s.result}`), null, 2));
await browser.close();
