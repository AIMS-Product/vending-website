// UI-based cleanup of session-created records (permitted: created this session).
// 1) Archive the SEO page draft via its row actions menu / editor controls.
// 2) Archive/delete the news draft via its editor if a control exists.
import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "reports/ux-persona-review/screenshots";
const PAGE_TITLE = "UX Review Test Page 1781052712783";
const NEWS_ID = "0abc5b3f-0443-45ca-9ee4-f7433a6e150b";
const results = [];

async function snap(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `cleanup-${name}.png`), timeout: 10000 }).catch(() => {});
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(8000);

  // --- SEO page: row actions menu ---
  try {
    await page.goto(BASE + "/admin/pages", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const row = page.locator(`tr:has-text("${PAGE_TITLE}")`).first();
    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      const menu = row.locator("button").last();
      await menu.click();
      await page.waitForTimeout(700);
      await snap(page, "seo-row-menu");
      const item = page.locator("[role=menuitem]:has-text('Archive'), [role=menu] button:has-text('Archive'), [role=menuitem]:has-text('Delete')").first();
      if (await item.isVisible({ timeout: 2500 }).catch(() => false)) {
        const label = (await item.innerText()).trim();
        await item.click();
        await page.waitForTimeout(900);
        const confirm = page.locator("[role=dialog] button:has-text('Archive'), [role=dialog] button:has-text('Delete'), [role=dialog] button:has-text('Confirm')").first();
        if (await confirm.isVisible({ timeout: 2500 }).catch(() => false)) {
          await confirm.click();
          await page.waitForTimeout(1800);
        }
        await snap(page, "seo-after-archive");
        const still = await page.locator(`tr:has-text("${PAGE_TITLE}")`).first().isVisible({ timeout: 2000 }).catch(() => false);
        results.push(`seo-page: clicked "${label}"; still in active list: ${still}`);
      } else {
        await snap(page, "seo-no-menu-item");
        results.push("seo-page: row menu had no Archive/Delete item — left in place");
      }
    } else {
      results.push("seo-page: row not found in list");
    }
  } catch (e) {
    results.push(`seo-page: error ${e.message.split("\n")[0]}`);
  }

  // --- News draft: open editor, look for archive/delete ---
  try {
    await page.goto(`${BASE}/admin/news/${NEWS_ID}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await snap(page, "news-editor");
    const ctl = page.locator("button:has-text('Archive'):visible, button:has-text('Delete'):visible, button:has-text('Unpublish'):visible").first();
    if (await ctl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const label = (await ctl.innerText()).trim();
      await ctl.click();
      await page.waitForTimeout(900);
      const confirm = page.locator("[role=dialog] button:has-text('Archive'), [role=dialog] button:has-text('Delete'), [role=dialog] button:has-text('Confirm')").first();
      if (await confirm.isVisible({ timeout: 2500 }).catch(() => false)) {
        await confirm.click();
        await page.waitForTimeout(1800);
      }
      await snap(page, "news-after-action");
      results.push(`news-draft: clicked "${label}"`);
    } else {
      results.push("news-draft: no Archive/Delete/Unpublish control in editor — left in place (draft status, not publicly visible)");
    }
  } catch (e) {
    results.push(`news-draft: error ${e.message.split("\n")[0]}`);
  }

  await browser.close();
  console.log(results.join("\n"));
})();
