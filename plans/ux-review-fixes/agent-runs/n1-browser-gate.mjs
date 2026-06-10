import { chromium } from "playwright";

const SHOTS = new URL("./shots/", import.meta.url).pathname;
const BASE = "http://localhost:3000";

function fail(msg) {
  console.error(`ASSERT FAIL: ${msg}`);
  process.exitCode = 1;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 1) /admin/pages — sidebar (expanded desktop) shows the Blog and news link
await page.goto(`${BASE}/admin/pages`, { waitUntil: "networkidle" });
const sidebarNav = page.locator('aside nav[aria-label="Admin sections"]');
const newsLinkOnPages = sidebarNav.getByRole("link", { name: /Blog and news/ });
if ((await newsLinkOnPages.count()) === 0) {
  fail('/admin/pages: "Blog and news" link not found in desktop sidebar Content nav');
} else {
  const href = await newsLinkOnPages.first().getAttribute("href");
  if (href !== "/admin/news") fail(`/admin/pages: Blog and news href is ${href}, expected /admin/news`);
  const ariaCurrent = await newsLinkOnPages.first().getAttribute("aria-current");
  if (ariaCurrent === "page") fail("/admin/pages: Blog and news should NOT be active on /admin/pages");
  console.log("OK /admin/pages: Blog and news link present, href=/admin/news, not active");
}

// Existing links still render
for (const [name, href] of [
  ["SEO pages", "/admin/pages"],
  ["Media library", "/admin/media"],
]) {
  const link = sidebarNav.getByRole("link", { name: new RegExp(name) });
  if ((await link.count()) === 0) fail(`/admin/pages: existing nav link "${name}" missing`);
  else console.log(`OK /admin/pages: existing link "${name}" -> ${href} present`);
}
const settingsLink = page
  .locator('aside nav[aria-label="Account settings"]')
  .getByRole("link", { name: /Settings/ });
if ((await settingsLink.count()) === 0) fail('/admin/pages: Settings link missing');
else console.log("OK /admin/pages: Settings link present");

await page.screenshot({ path: `${SHOTS}n1-pages-sidebar.png`, fullPage: true });

// 2) /admin/news — Blog and news link is marked active
await page.goto(`${BASE}/admin/news`, { waitUntil: "networkidle" });
const sidebarNavNews = page.locator('aside nav[aria-label="Admin sections"]');
const newsLinkOnNews = sidebarNavNews.getByRole("link", { name: /Blog and news/ });
if ((await newsLinkOnNews.count()) === 0) {
  fail('/admin/news: "Blog and news" link not found in desktop sidebar');
} else {
  const ariaCurrent = await newsLinkOnNews.first().getAttribute("aria-current");
  if (ariaCurrent !== "page") fail(`/admin/news: Blog and news aria-current is ${ariaCurrent}, expected "page"`);
  else console.log('OK /admin/news: Blog and news link marked active (aria-current="page")');
}
await page.screenshot({ path: `${SHOTS}n1-news-active.png`, fullPage: true });

await browser.close();
console.log(process.exitCode ? "BROWSER GATE: FAIL" : "BROWSER GATE: PASS");
