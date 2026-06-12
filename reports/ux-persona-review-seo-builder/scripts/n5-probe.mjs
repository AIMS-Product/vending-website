import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3002";
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n5-screens");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/admin/pages/redirects`, { waitUntil: "networkidle", timeout: 60000 });
const hasForm = await page.locator('input[name="sourcePath"]').count();
const heading = await page.locator("h1").first().textContent().catch(() => "(no h1)");
const bodyText = (await page.locator("body").innerText()).slice(0, 200);
console.log("h1:", heading);
console.log("sourcePath inputs:", hasForm);
console.log("body head:", JSON.stringify(bodyText));
console.log("pageerrors:", JSON.stringify(errors));
await page.screenshot({ path: path.join(SHOTS, "probe.png"), fullPage: true });
await browser.close();
