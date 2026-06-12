// CLS measurement harness for S1 (ux-verified-technical-fixes).
//
// Protocol: launch a FRESH chromium context per page with caching disabled so
// each measured load is a true cold first-hit (no warmed font cache, no warmed
// Next.js route cache reuse across browser sessions). The caller restarts
// `next start` between pages to also clear the server-side route cache, so the
// numbers reflect genuine cold loads.
//
// Usage: node measure-cls.mjs <baseUrl> <out.json> <path1> [path2 ...]
//   - If a path is literally "ARTICLE", the script discovers the first article
//     link from /news and measures that instead.
//
// For each page it records: cumulative layout-shift value (excluding entries
// with hadRecentInput) and the attributed shifting elements via entry.sources.

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const [, , baseUrl, outPath, ...rawPaths] = process.argv;

if (!baseUrl || !outPath || rawPaths.length === 0) {
  console.error(
    "Usage: node measure-cls.mjs <baseUrl> <out.json> <path1> [path2 ...]",
  );
  process.exit(1);
}

const SETTLE_MS = 8000;

async function discoverArticlePath(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/news`, { waitUntil: "networkidle" });
  const href = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href^="/news/"]'));
    const first = anchors.find((a) => {
      const h = a.getAttribute("href") || "";
      return h !== "/news" && h.startsWith("/news/") && h.length > "/news/".length;
    });
    return first ? first.getAttribute("href") : null;
  });
  await ctx.close();
  return href;
}

async function measurePage(browser, path) {
  // Fresh context => no shared cache between page measurements.
  const ctx = await browser.newContext({ bypassCSP: false });
  const page = await ctx.newPage();
  // Disable HTTP cache to force cold font/asset fetches every run.
  const client = await ctx.newCDPSession(page);
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });

  await page.addInitScript(() => {
    window.__cls = 0;
    window.__shiftSources = [];
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__cls += entry.value;
        const sources = (entry.sources || []).map((s) => {
          const node = s.node;
          let desc = "(unknown)";
          if (node && node.nodeType === 1) {
            const el = node;
            const id = el.id ? `#${el.id}` : "";
            const cls = el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
              : "";
            desc = `${el.tagName.toLowerCase()}${id}${cls}`;
          }
          return {
            node: desc,
            prev: s.previousRect
              ? { y: Math.round(s.previousRect.y), h: Math.round(s.previousRect.height) }
              : null,
            curr: s.currentRect
              ? { y: Math.round(s.currentRect.y), h: Math.round(s.currentRect.height) }
              : null,
          };
        });
        window.__shiftSources.push({
          value: Number(entry.value.toFixed(5)),
          startTime: Math.round(entry.startTime),
          sources,
        });
      }
    });
    obs.observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(SETTLE_MS);

  const result = await page.evaluate(() => ({
    cls: Number(window.__cls.toFixed(5)),
    shifts: window.__shiftSources,
  }));

  await ctx.close();
  return { path, ...result };
}

const browser = await chromium.launch();
const results = [];

for (const raw of rawPaths) {
  let path = raw;
  if (raw === "ARTICLE") {
    const discovered = await discoverArticlePath(browser);
    if (!discovered) {
      results.push({ path: "ARTICLE", error: "no article link found on /news" });
      continue;
    }
    path = discovered;
  }
  const r = await measurePage(browser, path);
  results.push(r);
  console.log(`${path}  CLS=${r.cls}`);
}

await browser.close();

writeFileSync(outPath, JSON.stringify({ baseUrl, settleMs: SETTLE_MS, results }, null, 2));
console.log(`\nWrote ${outPath}`);
