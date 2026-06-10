import { chromium } from "playwright";

const SHOTS = "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-verified-technical-fixes/agent-runs/shots";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Start on /admin/media (where the sidebar renders) to see the new item present.
await page.goto("http://localhost:3001/admin/media", { waitUntil: "networkidle" });
const sidebar = page.locator("aside").first();
await sidebar.screenshot({ path: `${SHOTS}/s11-sidebar-item-present.png` });

// Click the Content libraries link in the sidebar nav (scoped to avoid the
// matching link in the Media library page header).
const link = sidebar.getByRole("link", { name: /Content libraries/i });
await link.click();
await page.waitForURL("**/admin/libraries", { timeout: 15000 });
await page.waitForLoadState("networkidle");

// Screenshot the loaded /admin/libraries with the item active.
await sidebar.screenshot({ path: `${SHOTS}/s11-libraries-active.png` });

const ariaCurrent = await sidebar
  .getByRole("link", { name: /Content libraries/i })
  .getAttribute("aria-current");
const url = page.url();

console.log(JSON.stringify({ url, ariaCurrent }, null, 2));

await browser.close();
