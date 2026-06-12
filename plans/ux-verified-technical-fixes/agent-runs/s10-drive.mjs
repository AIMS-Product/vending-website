import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const SHOTS = "plans/ux-verified-technical-fixes/agent-runs/shots";

function uniqueSlug(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

async function createDraft(page, title, slug) {
  await page.goto(`${BASE}/admin/news/new`, { waitUntil: "networkidle" });
  await page.fill('input[name="title"]', title);
  // Slug may auto-fill from title; force our unique value to avoid collisions.
  await page.fill('input[name="slug"]', slug);
  await page.fill('textarea[name="excerpt"]', "Throwaway for S10 archive proof.");
  const body = page.locator('[aria-label="Body"]');
  await body.click();
  await page.keyboard.type("Throwaway body content for S10 archive verification.");
  await page.click('button[name="intent"][value="save"]');
  await page.waitForURL(/\/admin\/news\/[0-9a-f-]+/, { timeout: 15000 });
  const id = page.url().match(/\/admin\/news\/([0-9a-f-]+)/)[1];
  return id;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
page.on("dialog", (d) => d.accept()); // accept the AdminPageActionButton confirm

// --- Create two throwaway drafts ---
const slugA = uniqueSlug("uxfix-s10-throwaway");
const slugB = uniqueSlug("uxfix-s10-throwaway-bulk");
const idA = await createDraft(page, "uxfix-s10-throwaway", slugA);
const idB = await createDraft(page, "uxfix-s10-throwaway (bulk)", slugB);
console.log("created", { idA, slugA, idB, slugB });

// --- ROW ARCHIVE proof (post A) ---
await page.goto(`${BASE}/admin/news?status=draft`, { waitUntil: "networkidle" });
const rowA = page.locator("tr", { hasText: slugA });
await rowA.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${SHOTS}/s10-1-list-before-archive.png`, fullPage: true });

// open the row actions menu and click Archive post
await rowA.locator('summary[aria-label^="Open actions for"]').click();
await rowA.getByRole("button", { name: "Archive post" }).click();
// AdminPageActionButton opens a confirm dialog; confirm it
const dialog = page.locator("dialog[open]");
await dialog.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
const confirmBtn = page.getByRole("button", { name: /^Archive post$/ }).last();
await confirmBtn.click().catch(async () => {
  // fall back: some confirm dialogs label the affirmative differently
  await page.getByRole("button", { name: /confirm|archive/i }).last().click();
});

await page.waitForURL(/\/admin\/news/, { timeout: 15000 });
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${SHOTS}/s10-2-after-row-archive.png`, fullPage: true });

// verify A no longer in the draft filter, and present under archived
await page.goto(`${BASE}/admin/news?status=archived`, { waitUntil: "networkidle" });
const archivedRowA = page.locator("tr", { hasText: slugA });
const aArchivedVisible = await archivedRowA.count();
console.log("post A visible under archived filter:", aArchivedVisible);
await page.screenshot({ path: `${SHOTS}/s10-3-archived-filter-has-A.png`, fullPage: true });

// boundary: reload draft filter, A should be gone
await page.goto(`${BASE}/admin/news?status=draft`, { waitUntil: "networkidle" });
const aStillInDrafts = await page.locator("tr", { hasText: slugA }).count();
console.log("post A still in drafts after reload (expect 0):", aStillInDrafts);

// --- BULK ARCHIVE proof (post B) ---
await page.goto(`${BASE}/admin/news?status=draft`, { waitUntil: "networkidle" });
const rowB = page.locator("tr", { hasText: slugB });
await rowB.locator('input[type="checkbox"][name="ids"]').check();
await page.waitForTimeout(300); // let the client island update the count
await page.screenshot({ path: `${SHOTS}/s10-4-bulk-bar-visible.png`, fullPage: true });
await page.getByRole("button", { name: "Archive selected" }).click();
await page.waitForURL(/archived=/, { timeout: 15000 }).catch(() => {});
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${SHOTS}/s10-5-after-bulk-archive.png`, fullPage: true });
console.log("post-bulk url:", page.url());

// boundary: B should appear under archived filter
await page.goto(`${BASE}/admin/news?status=archived`, { waitUntil: "networkidle" });
const bArchived = await page.locator("tr", { hasText: slugB }).count();
console.log("post B visible under archived filter (expect 1):", bArchived);

await browser.close();
console.log("DONE", { idA, slugA, idB, slugB });
