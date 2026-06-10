// S6 screenshot capture for /case-studies — full page.
// Usage: node s6-shots.mjs <label>
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "run";
const BASE = "http://localhost:3001";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/case-studies`, { waitUntil: "networkidle" });
const file = path.join(__dirname, "shots", `s6-case-studies-${label}.png`);
await page.screenshot({ path: file, fullPage: true });
await browser.close();
console.log(`wrote ${file}`);
