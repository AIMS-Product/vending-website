// S17 check 1 — S20 click-through (the deferred gate).
// Start a page via the create gate, type a title, wait for autosave to assign
// a real page id, click the top-rail "Pages" back-link, and prove we land on
// /admin/pages?created=<id> with the green banner + highlighted row. Then
// archive the throwaway via the row "⋮" menu.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SHOTS =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs/shots";
// Unique per run: the page slug derives from the title and must be unique
// across active pages, so a fixed title collides with leftover throwaways.
const TITLE = `uxfix-s17-throwaway-${Date.now().toString(36)}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
page.on("dialog", (d) => d.accept());
page.on("console", (m) => {
  const t = m.text();
  if (/draft|autosave|create|error/i.test(t)) console.log("PAGE>", m.type(), t);
});
page.on("requestfailed", (r) =>
  console.log("REQFAIL>", r.url(), r.failure()?.errorText),
);
page.on("request", (r) => {
  if (r.method() === "POST") console.log("POST>", r.url());
});
page.on("response", (r) => {
  if (r.request().method() === "POST")
    console.log("POST-RESP>", r.status(), r.url());
});

const result = { steps: {} };

// --- start a page via the create gate ---
await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /start building page/i }).click();
await page.waitForTimeout(1500);

// --- reveal the title field. Expand the SEO panel via the rail toggle first
// (this mounts the controlled SEO fields), then use the readiness deep-link to
// scroll/focus the title input. This sequence reliably binds #page-title-field
// to the controller's `title` state that the S3b auto-create effect watches. ---
await page
  .getByRole("button", { name: /Expand SEO sidebar|Open SEO|^SEO$/i })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Add a page title/i }).first().click();
const titleField = page.locator("#page-title-field");
await titleField.waitFor({ state: "visible", timeout: 10000 });
await titleField.fill(TITLE);
// Blur the field (commits the derived slug) so the S3b create has a valid slug.
await titleField.press("Tab");
result.steps.titleValue = await titleField.inputValue();
result.steps.titleTyped = true;
console.log("title field value:", result.steps.titleValue);
await page.screenshot({ path: `${SHOTS}/s17-s20-0-title-typed.png`, fullPage: true });

// --- wait for autosave to turn effectivePageId from null -> real id.
// The top-rail "Pages" back-link href flips to /admin/pages?created=<id>.
// Target the back-link specifically inside the sticky top rail (it has the
// ChevronIcon + "Pages" label) to avoid any AdminShell breadcrumb link. ---
// The top-rail back-link is the link whose text is exactly "Pages" and whose
// href starts with /admin/pages. Read its CURRENT href each poll — it flips
// from /admin/pages to /admin/pages?created=<id> once autosave assigns the id.
const backLink = page
  .locator('a[href^="/admin/pages"]')
  .filter({ hasText: "Pages" })
  .first();
let createdId = null;
const deadline = Date.now() + 30000;
while (Date.now() < deadline) {
  const href = await backLink.getAttribute("href").catch(() => null);
  const m = href && href.match(/created=([0-9a-f-]+)/);
  if (m) {
    createdId = m[1];
    break;
  }
  // Diagnostic: the controller swaps the URL bar to /admin/pages/<id> via
  // history.replaceState once the draft row is created. Catch that too.
  const urlM = page.url().match(/\/admin\/pages\/([0-9a-f-]{8,})/);
  if (urlM) {
    createdId = urlM[1];
    console.log("draft id seen in URL bar (replaceState):", createdId);
    break;
  }
  await page.waitForTimeout(1000);
}
result.steps.createdId = createdId;
result.steps.backLinkHref = await backLink.getAttribute("href").catch(() => null);
console.log("autosave assigned page id:", createdId, "href:", result.steps.backLinkHref);

if (!createdId) {
  await page.screenshot({ path: `${SHOTS}/s17-s20-FAIL-no-id.png`, fullPage: true });
  console.log("RESULT", JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(2);
}

// --- click the back-link, expect ?created=<id> + green banner + highlight.
// Use a direct navigation guard: capture the href and click it. ---
const targetHref = result.steps.backLinkHref;
await backLink.scrollIntoViewIfNeeded();
await backLink.click();
await page.waitForURL(/\/admin\/pages\?created=/, { timeout: 15000 }).catch(async () => {
  // Fallback diagnostic: report where we actually landed.
  result.steps.unexpectedLanding = page.url();
});
await page.waitForLoadState("networkidle");
result.steps.landedUrl = page.url();

const banner = page.locator('[role="status"], [role="alert"]', {
  hasText: /created|added|new page/i,
});
const bannerVisible = await banner.first().isVisible().catch(() => false);
const bannerText = await banner.first().textContent().catch(() => null);
const openPageLink = page.getByRole("link", { name: /open page/i });
const openPageVisible = await openPageLink.first().isVisible().catch(() => false);
result.steps.banner = { visible: bannerVisible, text: bannerText?.trim(), openPageLink: openPageVisible };

const highlightRow = page.locator(`tr:has-text("${TITLE}")`);
result.steps.highlightRowCount = await highlightRow.count();

await page.screenshot({ path: `${SHOTS}/s17-s20-1-banner-row.png`, fullPage: true });
console.log("landed:", result.steps.landedUrl);
console.log("banner:", JSON.stringify(result.steps.banner));
console.log("row count:", result.steps.highlightRowCount);

// --- archive the throwaway via the row "⋮" menu ---
const row = highlightRow.first();
await row.scrollIntoViewIfNeeded();
// open the row actions menu (details summary or kebab button)
const kebab = row.locator('summary, button[aria-haspopup], button[aria-label*="actions" i], button[aria-label*="menu" i]').first();
await kebab.click().catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/s17-s20-2-row-menu.png`, fullPage: true });

const archiveItem = page.getByRole("button", { name: /archive/i }).first();
await archiveItem.click().catch(() => {});
await page.waitForTimeout(400);
// confirm dialog (AdminPageActionButton)
const confirm = page.getByRole("button", { name: /^archive/i }).last();
await confirm.click().catch(() => {});
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/s17-s20-3-after-archive.png`, fullPage: true });

// verify under archived filter
await page.goto(`${BASE}/admin/pages?status=archived`, { waitUntil: "networkidle" });
result.steps.archivedVisible = await page.locator(`tr:has-text("${TITLE}")`).count();
await page.screenshot({ path: `${SHOTS}/s17-s20-4-archived-filter.png`, fullPage: true });
console.log("archived filter row count:", result.steps.archivedVisible);

console.log("RESULT", JSON.stringify(result, null, 2));
await browser.close();
