import { chromium } from "playwright";
const BASE = "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.getByRole("button", { name: "Continue" }).first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Continue" }).first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Start building page" }).click();
await page.waitForTimeout(1000);

// Dismiss the first-run walkthrough overlay if present.
const skip = page.getByRole("button", { name: "Skip walkthrough" });
if (await skip.count()) { await skip.click(); await page.waitForTimeout(400); }

const checklist = page.locator("#publish-blocker-checklist");
await checklist.waitFor({ state: "visible", timeout: 10000 });

const titleItem = checklist.locator("li > button", { hasText: /page title/i }).first();
await titleItem.click();
await page.waitForTimeout(600);
console.log("TITLE_DEEPLINK_FOCUS:", await page.evaluate(() => document.activeElement?.id ?? "(none)"));

const slugItem = checklist.locator("li > button", { hasText: /URL slug/i }).first();
await slugItem.click();
await page.waitForTimeout(600);
console.log("SLUG_DEEPLINK_FOCUS:", await page.evaluate(() => document.activeElement?.id ?? "(none)"));

await browser.close();
