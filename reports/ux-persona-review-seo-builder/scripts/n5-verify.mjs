import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3002";
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n5-screens");
const REDIRECTS = `${BASE}/admin/pages/redirects`;

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
  console.log(`shot: ${name}`);
}

async function status(p) {
  // raw fetch via context request, do not follow redirects
  return p;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const ts = Date.now();
const throwaway = `/resources/n5-throwaway-${ts}`;
const control = `/resources/n5-control-${ts}`;
const throwawayDest = `/resources/n5-throwaway-dest-${ts}`;
const throwawayDest2 = `/resources/n5-throwaway-dest2-${ts}`;
const controlDest = `/resources/n5-control-dest-${ts}`;

async function curlStatus(reqCtx, p) {
  const res = await reqCtx.get(`${BASE}${p}`, { maxRedirects: 0 }).catch((e) => ({ statusErr: String(e) }));
  if (res.statusErr) return res.statusErr;
  return `${res.status()} -> ${res.headers()["location"] ?? "(none)"}`;
}

const api = ctx.request;

try {
  // ---- 1. CREATE throwaway + control ----
  await page.goto(REDIRECTS, { waitUntil: "networkidle" });
  await shot(page, "01-redirects-initial");

  async function createRedirect(src, dest) {
    await page.fill('input[name="sourcePath"]', src);
    await page.fill('input[name="destinationPath"]', dest);
    await page.selectOption('select[name="statusCode"]', "301");
    await Promise.all([
      page.waitForURL("**/redirects?created=1**", { timeout: 15000 }),
      page.click('button:has-text("Create redirect")'),
    ]);
  }

  await createRedirect(throwaway, throwawayDest);
  await shot(page, "02-created-throwaway");
  await createRedirect(control, controlDest);
  await shot(page, "03-created-control");

  // ---- 2. INVALID create: inline error + values preserved ----
  await page.fill('input[name="sourcePath"]', "/about-not-a-builder-path");
  await page.fill('input[name="destinationPath"]', "/blog/new");
  await page.click('button:has-text("Create redirect")');
  await page.waitForSelector('[aria-invalid="true"], [role="alert"], .text-red-700', { timeout: 8000 }).catch(() => {});
  const preservedSrc = await page.inputValue('input[name="sourcePath"]');
  const preservedDest = await page.inputValue('input[name="destinationPath"]');
  console.log(`invalid-create preserved source="${preservedSrc}" dest="${preservedDest}"`);
  await shot(page, "04-invalid-create-inline-error");

  // reset form by reloading
  await page.goto(REDIRECTS, { waitUntil: "networkidle" });

  // ---- BEFORE control-resolution snapshot ----
  const beforeThrowaway = await curlStatus(api, throwaway);
  const beforeControl = await curlStatus(api, control);
  console.log(`BEFORE throwaway ${throwaway}: ${beforeThrowaway}`);
  console.log(`BEFORE control   ${control}: ${beforeControl}`);

  // ---- 3. EDIT throwaway (change destination + status to 302) ----
  // open the edit form for the throwaway row
  const throwRow = page.locator("tr", { hasText: throwaway }).first();
  await throwRow.locator('button:has-text("Edit")').click();
  await shot(page, "05-edit-form-open");
  const editForm = page.locator('form:has(button:has-text("Save changes"))');
  await editForm.locator('input[name="destinationPath"]').fill(throwawayDest2);
  await editForm.locator('select[name="statusCode"]').selectOption("302");
  await Promise.all([
    page.waitForURL("**/redirects?updated=1**", { timeout: 15000 }),
    editForm.locator('button:has-text("Save changes")').click(),
  ]);
  await shot(page, "06-after-edit");
  const afterEdit = await curlStatus(api, throwaway);
  console.log(`AFTER-EDIT throwaway ${throwaway}: ${afterEdit} (expect 302 -> ${throwawayDest2})`);

  // ---- 3b. INVALID edit: inline error, nothing persisted ----
  const throwRow2 = page.locator("tr", { hasText: throwaway }).first();
  await throwRow2.locator('button:has-text("Edit")').click();
  const editForm2 = page.locator('form:has(button:has-text("Save changes"))');
  await editForm2.locator('input[name="destinationPath"]').fill("not-a-valid-destination");
  await editForm2.locator('button:has-text("Save changes")').click();
  await page.waitForSelector('[role="alert"], .text-red-700', { timeout: 8000 }).catch(() => {});
  await shot(page, "07-invalid-edit-inline-error");
  const afterInvalidEdit = await curlStatus(api, throwaway);
  console.log(`AFTER-INVALID-EDIT throwaway ${throwaway}: ${afterInvalidEdit} (expect unchanged 302 -> ${throwawayDest2})`);
  await page.goto(REDIRECTS, { waitUntil: "networkidle" });

  // ---- 4. DELETE throwaway via confirm dialog ----
  const throwRow3 = page.locator("tr", { hasText: throwaway }).first();
  await throwRow3.locator('button:has-text("Delete")').click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await shot(page, "08-delete-confirm-dialog");
  await Promise.all([
    page.waitForURL("**/redirects?deleted=1**", { timeout: 15000 }),
    page.click('[role="dialog"] button:has-text("Delete redirect")'),
  ]);
  await shot(page, "09-after-delete-throwaway");
  const afterDeleteThrowaway = await curlStatus(api, throwaway);
  console.log(`AFTER-DELETE throwaway ${throwaway}: ${afterDeleteThrowaway} (expect non-redirect)`);

  // ---- control still resolves unchanged after all throwaway ops ----
  const afterControl = await curlStatus(api, control);
  console.log(`AFTER-OPS control ${control}: ${afterControl} (expect identical to BEFORE: ${beforeControl})`);

  // ---- 5. Delete the 3 sanctioned test redirects ----
  const sanctioned = [
    "/resources/ux-old-test-1781071681847",
    "/resources/ux-old-test-1781071765035",
    "/resources/ux-explore-old-1781071765035",
  ];
  for (const src of sanctioned) {
    const before = await curlStatus(api, src);
    console.log(`SANCTIONED BEFORE ${src}: ${before}`);
  }
  await page.goto(REDIRECTS, { waitUntil: "networkidle" });
  await shot(page, "10-before-sanctioned-deletes");

  for (let i = 0; i < sanctioned.length; i++) {
    const src = sanctioned[i];
    const row = page.locator("tr", { hasText: src }).first();
    await row.locator('button:has-text("Delete")').click();
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
    await shot(page, `11-sanctioned-confirm-${i + 1}`);
    await Promise.all([
      page.waitForURL("**/redirects?deleted=1**", { timeout: 15000 }),
      page.click('[role="dialog"] button:has-text("Delete redirect")'),
    ]);
  }
  await page.goto(REDIRECTS, { waitUntil: "networkidle" });
  await shot(page, "12-after-sanctioned-deletes");

  for (const src of sanctioned) {
    const after = await curlStatus(api, src);
    console.log(`SANCTIONED AFTER ${src}: ${after} (expect non-redirect)`);
  }

  // ---- control still resolves after sanctioned deletes ----
  const finalControl = await curlStatus(api, control);
  console.log(`FINAL control ${control}: ${finalControl}`);

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors));
} catch (e) {
  console.error("FLOW_ERROR:", e);
  await shot(page, "zz-error");
  process.exitCode = 1;
} finally {
  await browser.close();
}
