import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__shifts = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) {
    window.__shifts.push({ value: Math.round(e.value*1000)/1000, t: Math.round(e.startTime), sources: (e.sources||[]).map(s => ({ node: s.node ? (s.node.tagName + "." + String(s.node.className||"").slice(0,50)) : "?", prev: s.previousRect ? `y${s.previousRect.y} h${s.previousRect.height}` : "", cur: s.currentRect ? `y${s.currentRect.y} h${s.currentRect.height}` : "" })) });
  }}).observe({ type: "layout-shift", buffered: true }); } catch {}
});
await page.goto("http://localhost:3100/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(1200);
await page.mouse.wheel(0, 2000);
await page.waitForTimeout(1500);
const shifts = await page.evaluate(() => window.__shifts);
console.log(JSON.stringify(shifts, null, 1).slice(0, 2500));
await browser.close();
