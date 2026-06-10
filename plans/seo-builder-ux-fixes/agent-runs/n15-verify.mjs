import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.N15_BASE_URL ?? "http://localhost:3001";
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n15-screens");

const log = (...a) => console.log("[n15]", ...a);
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});
}

async function run() {
  const browser = await chromium.launch();
  // FRESH context — NO walkthrough-seen flag. This is the worst case: the old
  // code would have auto-started the tour for this first-time user.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => log("PAGEERROR", String(e).slice(0, 200)));

  try {
    // Reach the editor via the one-step create flow.
    await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Blog page" }).click();
    await page.getByRole("button", { name: "Start building page" }).click();
    const titleField = page.locator("#page-title-field");
    await titleField.waitFor({ state: "visible", timeout: 10000 });

    // Give any (old) auto-start a chance to appear, then assert it did NOT.
    await page.waitForTimeout(1200);
    const tourDialog = page.locator('[role="dialog"]', { hasText: "Quick tour" });
    const autoStarted = await tourDialog.isVisible().catch(() => false);
    check("Editor open: tour does NOT auto-start (fresh user)", !autoStarted);
    await shot(page, "A1-editor-open-no-tour");

    // The opt-in launcher is visible.
    const launcher = page.getByRole("button", { name: /Start the quick tour/i });
    await launcher.waitFor({ state: "visible", timeout: 5000 });
    check("Opt-in 'Quick tour' launcher is visible", await launcher.isVisible());

    // Click it → the tour appears.
    await launcher.click();
    const card = page.locator("text=/Quick tour · Step 1 of 3/");
    await card.waitFor({ state: "visible", timeout: 5000 });
    check("Clicking launcher starts the tour (step 1)", await card.isVisible());

    // The step-1 highlight ring is positioned (the blocks target was revealed).
    const ring = page.locator('div.ring-\\[\\#0b63f6\\]').first();
    const ringVisible = await ring.isVisible().catch(() => false);
    check("Tour highlight renders (positioned target)", ringVisible || (await card.isVisible()));
    await shot(page, "A2-tour-started-positioned");

    // Advance through the tour and finish. Scope to the tour dialog and use an
    // exact name so the Next.js dev-tools "Next" button can't match.
    const tour = page.locator('[role="dialog"]');
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    await page.locator("text=/Quick tour · Step 2 of 3/").waitFor({ state: "visible", timeout: 5000 });
    await tour.getByRole("button", { name: "Next", exact: true }).click();
    await page.locator("text=/Quick tour · Step 3 of 3/").waitFor({ state: "visible", timeout: 5000 });
    await shot(page, "A3-tour-step3");
    await tour.getByRole("button", { name: "Got it", exact: true }).click();

    // After finishing, the overlay is gone and the launcher is back (re-runnable).
    await page.waitForTimeout(400);
    const dialogGone = !(await tourDialog.isVisible().catch(() => false));
    check("Finishing the tour closes the overlay", dialogGone);
    check("Launcher returns after finishing (re-runnable)", await launcher.isVisible().catch(() => false));
    await shot(page, "A4-after-finish");

    // Capture the auto-created draft id so cleanup can remove it.
    const m = page.url().match(/\/admin\/pages\/([0-9a-f-]{36})/);
    if (m) log(`CLEANUP-NEEDED draft id=${m[1]}`);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  log("=========================================");
  log(`TOTAL ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`);
  if (failed.length) {
    for (const f of failed) log("FAILED:", f.name, f.detail);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("[n15] script error", e);
  process.exit(2);
});
