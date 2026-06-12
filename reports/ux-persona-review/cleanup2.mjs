import { chromium } from "playwright";
const BASE = "http://localhost:3000";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(8000);
  await page.goto(BASE + "/admin/pages/badc89ea-6257-4819-8d52-6fe342881125", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const skip = page.locator("button:has-text('Skip tour')").first();
  if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) await skip.click().catch(() => {});
  await page.waitForTimeout(500);
  const ctl = page.locator("button:has-text('Archive'):visible").first();
  if (await ctl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ctl.click();
    await page.waitForTimeout(900);
    const confirm = page.locator("[role=dialog] button:has-text('Archive'), [role=dialog] button:has-text('Confirm')").first();
    if (await confirm.isVisible({ timeout: 2500 }).catch(() => false)) { await confirm.click(); await page.waitForTimeout(1800); }
    console.log("archived via editor");
  } else {
    const labels = await page.locator("button:visible").allInnerTexts().catch(() => []);
    console.log("no Archive in editor; visible buttons:", JSON.stringify(labels.filter(Boolean).slice(0, 25)));
  }
  await browser.close();
})();
