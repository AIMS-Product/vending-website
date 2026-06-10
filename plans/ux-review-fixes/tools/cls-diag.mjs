import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__shifts = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) {
    window.__shifts.push({ value: Math.round(e.value*1000)/1000, t: Math.round(e.startTime), sources: (e.sources||[]).map(s => ({ node: s.node ? (s.node.tagName + "." + String(s.node.className||"").slice(0,60)) : "?", prev: s.previousRect ? `${s.previousRect.y},${s.previousRect.height}` : "", cur: s.currentRect ? `${s.currentRect.y},${s.currentRect.height}` : "" })) });
  }}).observe({ type: "layout-shift", buffered: true }); } catch {}
});
await page.goto("http://localhost:3100/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => window.__shifts), null, 1));
await browser.close();
