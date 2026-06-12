// S5 visual proof — article + news editor at desktop, after the landmark hoist.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, "shots");
const BASE = "http://localhost:3001";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/news/how-to-choose-the-perfect-location-for-vending-machine`, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(SHOTS, "s5-article-desktop.png"), fullPage: true });

await page.goto(`${BASE}/admin/news/new`, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(SHOTS, "s5-news-new-desktop.png") });

await browser.close();
console.log("wrote s5-article-desktop.png, s5-news-new-desktop.png");
