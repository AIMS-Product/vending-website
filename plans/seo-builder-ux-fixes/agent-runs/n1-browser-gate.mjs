import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001";
const SHOTS = path.resolve(
  "plans/seo-builder-ux-fixes/agent-runs/n1-screens",
);
const out = [];
function log(m) {
  out.push(m);
  console.log(m);
}
async function shot(page, name) {
  await page
    .screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
    .catch(() => {});
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1500, height: 1000 },
});
const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") log(`CONSOLE_ERROR: ${msg.text().slice(0, 200)}`);
});

try {
  await page.goto(`${BASE}/admin/pages/new`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // Wizard: page type -> blank -> start building.
  await page.getByRole("button", { name: "Continue" }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Continue" }).first().click();
  await page.waitForTimeout(300);
  await page
    .getByRole("button", { name: "Start building page" })
    .click();
  await page.waitForTimeout(800);
  await shot(page, "01-blank-editor");

  // Stage 1: the canonical checklist shows EVERY blocker at once.
  const checklist = page.locator("#publish-blocker-checklist");
  await checklist.waitFor({ state: "visible", timeout: 10000 });
  const items = checklist.locator("li > button");
  const itemCount = await items.count();
  log(`BLOCKER_ITEMS_VISIBLE: ${itemCount}`);
  const labels = await items.allInnerTexts();
  log(`BLOCKER_LABELS:\n${labels.map((l) => "  - " + l.replace(/\n/g, " ")).join("\n")}`);
  await shot(page, "02-all-blockers-visible");

  // The disabled Publish button references the checklist (aria-describedby).
  const publishBtn = page
    .getByRole("button", { name: "Publish", exact: true })
    .first();
  const describedBy = await publishBtn.getAttribute("aria-describedby");
  const ariaDisabled = await publishBtn.getAttribute("aria-disabled");
  log(`PUBLISH_ARIA_DESCRIBEDBY: ${describedBy}`);
  log(`PUBLISH_ARIA_DISABLED: ${ariaDisabled}`);

  // The list is a live region.
  const liveAttr = await checklist.getAttribute("aria-live");
  log(`CHECKLIST_ARIA_LIVE: ${liveAttr}`);

  // Stage 2: deep-link a SEO field blocker (page title) -> field focused.
  const titleItem = checklist
    .locator("li > button", { hasText: /page title/i })
    .first();
  if (await titleItem.count()) {
    await titleItem.scrollIntoViewIfNeeded().catch(() => {});
    await titleItem.click({ force: true });
    await page.waitForTimeout(500);
    const activeId = await page.evaluate(() => document.activeElement?.id ?? "");
    log(`AFTER_TITLE_DEEPLINK_ACTIVE_ELEMENT_ID: ${activeId}`);
    await shot(page, "03-title-field-focused");
  }

  // Fill the SEO meta fields to clear those blockers.
  await page
    .getByLabel("Page title", { exact: true })
    .fill("ZZZ N1 throwaway test page DELETE ME");
  await page.getByLabel("Slug", { exact: true }).fill("zzz-n1-throwaway-delete-me");
  await page
    .getByLabel("SEO title", { exact: true })
    .fill("ZZZ N1 throwaway test page");
  await page
    .getByLabel("Meta description", { exact: true })
    .fill(
      "A complete guide to running a profitable vending machine business in 2026.",
    );
  await page.waitForTimeout(500);
  await shot(page, "04-meta-filled");

  // After typing a title, the draft auto-creates (~1.2s). Wait for save-first
  // to drop and conversion-block / other blockers to remain.
  await page.waitForTimeout(2500);
  const remaining = await checklist.locator("li > button").allInnerTexts();
  log(
    `BLOCKERS_AFTER_META:\n${remaining.map((l) => "  - " + l.replace(/\n/g, " ")).join("\n")}`,
  );
  await shot(page, "05-after-autosave");

  // Axe scan scoped to the publish panel.
  try {
    const results = await new AxeBuilder({ page })
      .include('[data-builder-walkthrough="seo"]')
      .analyze();
    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      count: v.nodes.length,
    }));
    log(`AXE_VIOLATIONS: ${JSON.stringify(violations)}`);
  } catch (e) {
    log(`AXE_ERROR: ${String(e.message).slice(0, 200)}`);
  }

  log("DONE");
} catch (e) {
  log(`SCRIPT_ERROR: ${String(e.stack || e).slice(0, 600)}`);
  await shot(page, "99-error");
} finally {
  fs.writeFileSync(
    path.join(SHOTS, "..", "n1-browser-gate.log"),
    out.join("\n"),
  );
  await browser.close();
}
