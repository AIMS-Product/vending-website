import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.N6_BASE_URL ?? "http://localhost:3003";
const SHOTS = path.resolve(
  "plans/seo-builder-ux-fixes/agent-runs/n6-screens",
);
const STAMP = Date.now();
const DISCARD_TITLE = `N6 Discard Throwaway ${STAMP}`;
const SAVE_TITLE = `N6 Save Throwaway ${STAMP}`;

const log = (...a) => console.log("[n6]", ...a);
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});
}

async function startBlankBuild(page) {
  await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "networkidle" });
  // Step 1 Continue → Step 2 Continue → Step 3 Start building
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start building page" }).click();
  await page.waitForTimeout(400);
}

async function typeTitle(page, title) {
  // The title field is the page title input; target by its label/id.
  const titleField = page.locator("#page-title-field");
  await titleField.waitFor({ state: "visible", timeout: 10000 });
  await titleField.fill(title);
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  // Skip the first-run builder walkthrough so it never overlays the title field.
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("page-builder-editor-walkthrough-seen", "1");
    } catch {}
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => log("PAGEERROR", String(e).slice(0, 200)));

  try {
    // ---- Flow A: auto-create → notice → intercept → Discard deletes row ----
    await startBlankBuild(page);
    await typeTitle(page, DISCARD_TITLE);

    // S3b auto-creates the draft after ~1.2s and swaps the URL to /admin/pages/{id}
    await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}$/, { timeout: 8000 });
    const autoId = page.url().split("/").pop();
    check("S3b auto-created draft (URL swapped to row id)", Boolean(autoId), autoId);

    const notice = page.getByRole("status").filter({ hasText: "Draft created" });
    await notice.waitFor({ state: "visible", timeout: 6000 });
    check("'Draft created' notice visible on auto-created row", await notice.isVisible());
    await shot(page, "A1-draft-created-notice");

    // Click the in-app "Pages" link — guard must intercept and show the dialog.
    await page.getByRole("link", { name: "Pages" }).click();
    const dialog = page.getByRole("dialog", { name: /Keep this draft/i });
    await dialog.waitFor({ state: "visible", timeout: 6000 });
    check("In-app nav intercepted: unsaved-exit dialog shown", await dialog.isVisible());
    const stillOnEditor = /\/admin\/pages\/[0-9a-f-]{36}$/.test(page.url());
    check("Navigation was blocked (still on editor)", stillOnEditor, page.url());
    await shot(page, "A2-unsaved-exit-dialog");

    // Discard → deletes the auto-row and navigates to the pages list.
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.waitForURL(/\/admin\/pages(\?.*)?$/, { timeout: 8000 });
    await page.waitForLoadState("networkidle");
    check("Discard navigated to pages list", /\/admin\/pages/.test(page.url()), page.url());

    const discardRowGone = (await page.getByText(DISCARD_TITLE).count()) === 0;
    check("Discarded draft removed from pages list", discardRowGone);
    await shot(page, "A3-pages-list-after-discard");

    // ---- Flow B: explicit Save → no destructive Discard offer on leave ----
    await startBlankBuild(page);
    await typeTitle(page, SAVE_TITLE);
    await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}$/, { timeout: 8000 });
    const savedId = page.url().split("/").pop();

    // Explicit Save draft (the top-rail submit). For an already auto-created
    // row this saves in place (no ?saved=1 redirect), so wait for the save
    // confirmation toast instead of a URL change.
    await page.getByRole("button", { name: "Save draft" }).first().click();
    const savedToast = page.getByText(/Draft saved|saved automatically/i).first();
    await savedToast.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1200);
    check("Explicit Save completed without error", true, page.url());
    await shot(page, "B1-after-explicit-save");

    // Now leaving must NOT show the destructive guard — plain navigation.
    await page.getByRole("link", { name: "Pages" }).click();
    let destructiveOffered = false;
    try {
      await page.getByRole("dialog", { name: /Keep this draft/i }).waitFor({
        state: "visible",
        timeout: 2500,
      });
      destructiveOffered = true;
    } catch {
      destructiveOffered = false;
    }
    check("Explicitly-saved page: NO destructive Discard offer", !destructiveOffered);
    await page.waitForURL(/\/admin\/pages(\?.*)?$/, { timeout: 8000 }).catch(() => {});
    await shot(page, "B2-saved-page-plain-leave");

    // The explicitly-saved row MUST still exist (invariant: never deleted).
    await page.goto(`${BASE}/admin/pages`, { waitUntil: "networkidle" });
    const savedRowExists = (await page.getByText(SAVE_TITLE).count()) > 0;
    check("Explicitly-saved row still present (never deleted)", savedRowExists, savedId);
    await shot(page, "B3-saved-row-present");

    // ---- Cleanup: the saved throwaway must be removed (PROD Supabase) ----
    log(`CLEANUP-NEEDED saved row id=${savedId} title="${SAVE_TITLE}"`);
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
  console.error("[n6] script error", e);
  process.exit(2);
});
