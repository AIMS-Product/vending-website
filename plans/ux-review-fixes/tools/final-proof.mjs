import { chromium } from "playwright";
const BASE = "http://localhost:3100";
const TS = Date.now();
const out = {};
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on("pageerror", e => consoleErrors.push(String(e).slice(0,200)));
page.on("console", m => { if (m.type()==="error") consoleErrors.push(m.text().slice(0,200)); });
await page.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {} });

// 1. home CLS + console
await page.goto(BASE + "/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(2500);
await page.mouse.wheel(0, 2000); await page.waitForTimeout(1000);
out.homeCLS = await page.evaluate(() => Math.round(window.__cls * 1000) / 1000);
await page.screenshot({ path: "plans/ux-review-fixes/agent-runs/shots/n14-home-prod.png" });

// 2. skip link first tab stop
await page.goto(BASE + "/", { waitUntil: "load" });
await page.keyboard.press("Tab");
out.firstTabStop = await page.evaluate(() => (document.activeElement?.textContent || "").trim().slice(0, 40));

// 3. news CLS
await page.goto(BASE + "/news", { waitUntil: "load" }); await page.waitForTimeout(2000);
out.newsCLS = await page.evaluate(() => Math.round(window.__cls * 1000) / 1000);

// 4. apply journey end-to-end
await page.goto(BASE + "/apply", { waitUntil: "load" });
const email = `test+uxfinal-${TS}@example.com`;
for (const [sel, val] of [["input[name=full_name]","UX Final Proof"],["input[name=email]",email],["input[name=phone]","0400000000"],["input[name=city]","Testville"]]) {
  await page.fill(sel, val).catch(()=>{});
}
const selects = await page.locator("select").all();
for (const s of selects) { const n = await s.locator("option").count(); if (n>1) await s.selectOption({ index: 1 }).catch(()=>{}); }
await page.locator("textarea").first().fill("Final proof run. Safe to delete.").catch(()=>{});
await page.locator("button[type=submit]").first().click();
await page.waitForURL("**/thank-you-for-applying**", { timeout: 15000 }).catch(()=>{});
out.applyEndsAt = page.url().replace(BASE, "");
out.applyEmail = email;
await page.screenshot({ path: "plans/ux-review-fixes/agent-runs/shots/n14-apply-thankyou-prod.png" });

// 5. mobile overflow on / and /case-studies
await page.setViewportSize({ width: 375, height: 667 });
for (const [key, path] of [["homeOverflow","/"],["caseOverflow","/case-studies"]]) {
  await page.goto(BASE + path, { waitUntil: "load" }); await page.waitForTimeout(800);
  out[key] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
out.consoleErrors = [...new Set(consoleErrors)].slice(0, 8);
console.log(JSON.stringify(out, null, 2));
await browser.close();
