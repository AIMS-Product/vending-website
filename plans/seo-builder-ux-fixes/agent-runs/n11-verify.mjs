import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const PAGE_ID = process.argv[2] || "e44f0fc3-0dcf-480f-9c99-f3409c690378";
const URL = `${BASE}/admin/pages/${PAGE_ID}`;
const DIR = "plans/seo-builder-ux-fixes/agent-runs/n11-screens";

const browser = await chromium.launch();

async function verifyMobile() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);

  // The fixed action bar lives in the "Editor actions" region.
  const bar = page.getByRole("region", { name: "Editor actions" });
  const barVisibleInitial = await bar.isVisible().catch(() => false);

  // Scroll the page deep; the fixed bar's Save must stay onscreen.
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/after-mobile-scrolled.png` });

  const barSave = bar.getByRole("button", { name: /save draft|^save$/i }).first();
  const saveBox = await barSave.boundingBox().catch(() => null);
  const saveOnscreenWhileScrolled = saveBox ? saveBox.y >= 0 && saveBox.y < 844 : false;

  // Open the SEO/publish panel from the bar.
  const seoEntry = bar.getByRole("button", { name: /SEO & publish/i }).first();
  await seoEntry.click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/after-mobile-seo-open.png` });

  const publishBtn = page.getByRole("button", { name: /^publish/i }).first();
  const publishReachable = await publishBtn.isVisible().catch(() => false);

  // The bar should still be fixed/onscreen with the panel open, and now offer to close.
  const closeEntry = bar.getByRole("button", { name: /close seo panel/i }).first();
  const closeOffered = await closeEntry.isVisible().catch(() => false);
  const barSaveBox2 = await barSave.boundingBox().catch(() => null);
  const saveOnscreenWithPanel = barSaveBox2 ? barSaveBox2.y >= 0 && barSaveBox2.y < 844 : false;

  // Close the panel again.
  await closeEntry.click().catch(() => {});
  await page.waitForTimeout(300);
  const panelClosed = !(await publishBtn.isVisible().catch(() => false));

  // Keyboard: tab into the bar buttons, ensure focusable (no trap check: just that both are reachable).
  await ctx.close();
  return {
    barVisibleInitial,
    saveOnscreenWhileScrolled,
    saveBox,
    publishReachableViaSeoEntry: publishReachable,
    closeOffered,
    saveOnscreenWithPanel,
    panelClosed,
  };
}

async function verifyDesktop() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  const bar = page.getByRole("region", { name: "Editor actions" });
  const barVisible = await bar.isVisible().catch(() => false);
  await page.screenshot({ path: `${DIR}/after-desktop-1440.png` });
  // top-rail Save still present on desktop
  const topSave = page.getByRole("button", { name: /save draft|^save$/i }).first();
  const topSaveVisible = await topSave.isVisible().catch(() => false);
  await ctx.close();
  return { mobileBarHiddenOnDesktop: !barVisible, topRailSaveVisible: topSaveVisible };
}

const mobile = await verifyMobile();
const desktop = await verifyDesktop();
console.log(JSON.stringify({ mobile, desktop }, null, 2));
await browser.close();
