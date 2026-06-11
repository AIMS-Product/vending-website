// S17 check 2 — news cleanup. Archive the draft "uxfix-s19-throwaway" via the
// NEW row actions menu (re-proves S10 row archive on a real target), then
// confirm the two S10 throwaways remain archived.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const SHOTS =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs/shots";
const S19_ID = "6078e5be-6829-4b8a-af16-bd0cd9bb1dbf";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

const out = {};

// --- archive uxfix-s19-throwaway via the row menu ---
await page.goto(`${BASE}/admin/news?status=draft`, { waitUntil: "networkidle" });
const row = page.locator(`tr:has(a[href="/admin/news/${S19_ID}"])`).first();
out.s19BeforeInDrafts = await row.count();
if (out.s19BeforeInDrafts > 0) {
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/s17-news-s19-before.png`, fullPage: true });
  await row.locator('summary[aria-label^="Open actions for"]').click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Archive post" }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
}

// verify archived + gone from drafts
await page.goto(`${BASE}/admin/news?status=archived`, { waitUntil: "networkidle" });
out.s19ArchivedRows = await page.locator(`tr:has(a[href="/admin/news/${S19_ID}"])`).count();
await page.screenshot({ path: `${SHOTS}/s17-news-s19-after.png`, fullPage: true });
await page.goto(`${BASE}/admin/news?status=draft`, { waitUntil: "networkidle" });
out.s19StillInDrafts = await page.locator(`tr:has(a[href="/admin/news/${S19_ID}"])`).count();

// --- confirm the two S10 throwaways remain archived ---
await page.goto(`${BASE}/admin/news?status=archived`, { waitUntil: "networkidle" });
out.s10ThrowawayArchived = await page
  .locator('tr', { hasText: "uxfix-s10-throwaway-mq8oijc8" })
  .count();
out.s10BulkThrowawayArchived = await page
  .locator('tr', { hasText: "uxfix-s10-throwaway-bulk-mq8oijc8" })
  .count();
await page.screenshot({ path: `${SHOTS}/s17-news-archived-filter.png`, fullPage: true });

console.log(JSON.stringify(out, null, 2));
await browser.close();
