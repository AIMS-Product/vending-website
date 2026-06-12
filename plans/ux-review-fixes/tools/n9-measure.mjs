import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PAGES = [
  '/',
  '/case-studies',
  '/news',
  '/apply',
  '/contact',
  '/about',
  '/news/how-to-choose-the-perfect-location-for-vending-machine',
];

const MOBILE = { width: 375, height: 667 };

const cullScript = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  const all = document.querySelectorAll('*');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      // Build a compact selector
      let sel = el.tagName.toLowerCase();
      if (el.id) sel += '#' + el.id;
      if (el.className && typeof el.className === 'string') {
        sel += '.' + el.className.trim().split(/\\s+/).slice(0, 4).join('.');
      }
      out.push({
        sel,
        right: Math.round(r.right),
        left: Math.round(r.left),
        width: Math.round(r.width),
        text: (el.textContent || '').trim().slice(0, 40),
      });
    }
  }
  // Sort by furthest-right, dedupe by selector, keep top offenders
  out.sort((a, b) => b.right - a.right);
  const seen = new Set();
  const top = [];
  for (const o of out) {
    if (seen.has(o.sel)) continue;
    seen.add(o.sel);
    top.push(o);
    if (top.length >= 8) break;
  }
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    offenders: top,
  };
})()`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2 });
const page = await ctx.newPage();

let anyFail = false;
for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const res = await page.evaluate(cullScript);
  const overflow = res.scrollWidth - res.clientWidth;
  const fail = overflow > 4;
  if (fail) anyFail = true;
  console.log(`\n=== ${path} ===`);
  console.log(`scrollWidth=${res.scrollWidth} clientWidth=${res.clientWidth} overflow=${overflow} ${fail ? 'FAIL' : 'OK'}`);
  if (fail && res.offenders.length) {
    console.log('Offenders (right > viewport):');
    for (const o of res.offenders) {
      console.log(`  right=${o.right} left=${o.left} w=${o.width} | ${o.sel} | "${o.text}"`);
    }
  }
}

await browser.close();
console.log(anyFail ? '\nRESULT: OVERFLOW DETECTED' : '\nRESULT: ALL PAGES PASS');
process.exit(0);
