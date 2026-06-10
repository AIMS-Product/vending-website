import { chromium } from "playwright";
const BASE = "http://localhost:3000";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(8000);
  await page.goto(BASE + "/admin/pages", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const row = page.locator('tr:has-text("UX Review Test Page")').first();
  if (!(await row.isVisible({ timeout: 5000 }).catch(() => false))) { console.log("row not found"); await browser.close(); return; }
  const menuBtn = row.locator("button[aria-haspopup], button[aria-label*=action i], td:last-child button").first();
  await menuBtn.dispatchEvent("click").catch(async () => { await menuBtn.click({ force: true }).catch(() => {}); });
  await page.waitForTimeout(900);
  const items = await page.locator("[role=menuitem]:visible, [role=menu] button:visible").allInnerTexts().catch(() => []);
  console.log("menu items:", JSON.stringify(items));
  const arch = page.locator("[role=menuitem]:has-text('Archive'), [role=menu] button:has-text('Archive')").first();
  if (await arch.isVisible({ timeout: 2000 }).catch(() => false)) {
    await arch.click();
    await page.waitForTimeout(900);
    const confirm = page.locator("[role=dialog] button:has-text('Archive'), [role=dialog] button:has-text('Confirm')").first();
    if (await confirm.isVisible({ timeout: 2500 }).catch(() => false)) { await confirm.click(); await page.waitForTimeout(1800); }
    const still = await page.locator('tr:has-text("UX Review Test Page")').first().isVisible({ timeout: 2500 }).catch(() => false);
    console.log("archived; still visible in active list:", still);
  } else {
    console.log("no Archive menu item");
  }
  await browser.close();
})();
