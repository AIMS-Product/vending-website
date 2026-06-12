// Inspect the list page for the created page 8f994979 — banner + highlighted row.
import { chromium } from "playwright";
const ID = "8f994979-0962-4df1-aa9a-e684193b61e5";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

await page.goto(`${BASE}/admin/pages?created=${ID}`, { waitUntil: "networkidle" });

const info = await page.evaluate(() => {
  const banner = document.querySelector('[role="status"]');
  const createdRow = document.querySelector('[data-created-row="true"]');
  const tabs = [...document.querySelectorAll("a,button")]
    .map((e) => e.textContent?.trim())
    .filter((t) => t && /draft|publish|archiv|all/i.test(t))
    .slice(0, 12);
  return {
    bannerText: banner?.textContent?.trim() ?? null,
    bannerHasOpenPage: !!banner && /open page/i.test(banner.textContent || ""),
    createdRowText: createdRow?.textContent?.trim()?.slice(0, 120) ?? null,
    url: location.href,
    filterTabs: tabs,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({
  path: "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs/shots/s17-verify-banner.png",
  fullPage: true,
});
await browser.close();
