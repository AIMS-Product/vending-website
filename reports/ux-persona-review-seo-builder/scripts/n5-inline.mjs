import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3002";
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n5-screens");
const REDIRECTS = `${BASE}/admin/pages/redirects`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Fresh page, no ?created banner
await page.goto(REDIRECTS, { waitUntil: "networkidle" });

await page.fill('input[name="sourcePath"]', "/about-not-a-builder-path");
await page.fill('input[name="destinationPath"]', "/blog/keep-this-value");
await page.click('button:has-text("Create redirect")');

// Give the action time to return and re-render
await page.waitForTimeout(2500);

const url = page.url();
const src = await page.inputValue('input[name="sourcePath"]');
const dest = await page.inputValue('input[name="destinationPath"]');
const ariaInvalid = await page.getAttribute('input[name="sourcePath"]', "aria-invalid");
const inlineErr = await page
  .locator('label:has(input[name="sourcePath"]) .text-red-700')
  .first()
  .textContent()
  .catch(() => "(none)");

console.log("URL:", url);
console.log("source value:", JSON.stringify(src));
console.log("destination value:", JSON.stringify(dest));
console.log("source aria-invalid:", ariaInvalid);
console.log("inline error under source:", JSON.stringify(inlineErr));

await page.screenshot({ path: path.join(SHOTS, "04b-invalid-create-isolated.png"), fullPage: true });
await browser.close();
