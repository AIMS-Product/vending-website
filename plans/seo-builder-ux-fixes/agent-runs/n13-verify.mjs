import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.N13_BASE_URL ?? "http://localhost:3001";
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n13-screens");
const STAMP = Date.now();
const TITLE = `N13 Throwaway ${STAMP}`;

const log = (...a) => console.log("[n13]", ...a);
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Skip the first-run builder walkthrough so it never overlays the form.
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("page-builder-editor-walkthrough-seen", "1");
    } catch {}
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => log("PAGEERROR", String(e).slice(0, 200)));

  try {
    // ---- Create journey: entry → single step (no forced multi-step) → editor ----
    await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "networkidle" });
    await shot(page, "A1-create-single-step");

    const body = await page.locator("body").innerText();
    check("No 3-step scaffolding text on entry", !/Step 1 of 3|Step 2 of 3|Step 3 of 3/.test(body));
    check("Single step shows page-type choices", /SEO \/ Resource page/.test(body) && /Blog page/.test(body));
    check("Start building action present immediately", /Start building/.test(body));

    // There must be NO "Continue" progression button (the old wizard had two).
    const continueButtons = await page.getByRole("button", { name: /^Continue$/ }).count();
    check("No multi-step Continue buttons", continueButtons === 0, `found ${continueButtons}`);

    // One interaction reaches the editor: pick a type, then Start building.
    await page.getByRole("button", { name: "Blog page" }).click();
    await page.getByRole("button", { name: "Start building page" }).click();

    // Editor open: the title field is present.
    const titleField = page.locator("#page-title-field");
    await titleField.waitFor({ state: "visible", timeout: 10000 });
    check("Editor opens after a single Start building click", await titleField.isVisible());
    await shot(page, "A2-editor-open");

    // ---- N6 regression: draft-on-type + Draft created notice + guard + Discard ----
    await titleField.fill(TITLE);
    await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}$/, { timeout: 8000 });
    const autoId = page.url().split("/").pop();
    check("N6: draft-on-type still auto-creates a row", Boolean(autoId), autoId);

    const notice = page.getByRole("status").filter({ hasText: "Draft created" });
    await notice.waitFor({ state: "visible", timeout: 6000 });
    check("N6: 'Draft created' notice still shows", await notice.isVisible());
    await shot(page, "A3-draft-created-notice");

    // Leaving offers the unsaved-exit guard.
    await page.getByRole("link", { name: "Pages" }).click();
    const dialog = page.getByRole("dialog", { name: /Keep this draft/i });
    await dialog.waitFor({ state: "visible", timeout: 6000 });
    check("N6: unsaved-exit guard still intercepts navigation", await dialog.isVisible());
    await shot(page, "A4-unsaved-exit-dialog");

    // Discard deletes the auto-row → no orphan rows from the new flow.
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page.waitForURL(/\/admin\/pages(\?.*)?$/, { timeout: 8000 });
    await page.waitForLoadState("networkidle");
    const rowGone = (await page.getByText(TITLE).count()) === 0;
    check("N6: Discard deletes the auto-row (no orphan)", rowGone);
    await shot(page, "A5-pages-list-after-discard");
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
  console.error("[n13] script error", e);
  process.exit(2);
});
