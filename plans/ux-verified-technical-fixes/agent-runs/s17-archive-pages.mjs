// Archive the S17 throwaway pages via the row "⋮" menu (also re-proves the
// pages-list row archive). Flow: open the per-row actions <details> menu
// (summary aria-label "Open actions for <title>"), click "Archive page" (opens
// a portaled <dialog>), then click "Confirm".
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const SHOTS =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs/shots";
const TARGETS = [
  { id: "8f994979-0962-4df1-aa9a-e684193b61e5", short: "8f994979", label: "created (banner row)" },
  { id: "2b7ee5a0-3a59-4142-bb61-9ef4307910af", short: "2b7ee5a0", label: "run-1 orphan" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

const out = [];
for (const t of TARGETS) {
  await page.goto(`${BASE}/admin/pages?status=draft`, { waitUntil: "networkidle" });
  const row = page.locator(`tr:has(a[href="/admin/pages/${t.id}"])`).first();
  const before = await row.count();
  if (before === 0) {
    out.push({ ...t, beforeRows: 0, note: "not in drafts" });
    continue;
  }
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/s17-page-archive-${t.short}-before.png`, fullPage: true });

  // 1) open the row actions menu
  await row.locator('summary[aria-label^="Open actions for"]').click();
  await page.waitForTimeout(250);
  // 2) click "Archive page" (the submit button that opens the confirm dialog)
  await page.getByRole("button", { name: "Archive page" }).first().click();
  // 3) the portaled <dialog> appears; click Confirm
  const dialog = page.locator("dialog[open]");
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}/s17-page-archive-${t.short}-confirm.png`, fullPage: true });
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);

  // verify under archived filter
  await page.goto(`${BASE}/admin/pages?status=archived`, { waitUntil: "networkidle" });
  const archived = await page.locator(`tr:has(a[href="/admin/pages/${t.id}"])`).count();
  await page.screenshot({ path: `${SHOTS}/s17-page-archive-${t.short}-after.png`, fullPage: true });
  // boundary: gone from drafts
  await page.goto(`${BASE}/admin/pages?status=draft`, { waitUntil: "networkidle" });
  const stillDraft = await page.locator(`tr:has(a[href="/admin/pages/${t.id}"])`).count();
  out.push({ ...t, beforeRows: before, archivedRows: archived, stillInDrafts: stillDraft });
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
