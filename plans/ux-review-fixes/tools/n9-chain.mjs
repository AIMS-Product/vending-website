import { chromium } from 'playwright';
const BASE = 'http://localhost:3000';
const MOBILE = { width: 375, height: 667 };

const script = `(() => {
  // find the Benefits h2 then walk up to body, report each ancestor width + overflowX
  const h2 = [...document.querySelectorAll('h2')].find(e => /Why Vendingpreneurs/i.test(e.textContent||''));
  if (!h2) return { err: 'no h2' };
  const chain = [];
  let el = h2;
  while (el && el !== document.documentElement.parentElement) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    let sel = el.tagName.toLowerCase();
    if (el.className && typeof el.className==='string') sel += '.'+el.className.trim().split(/\\s+/).slice(0,3).join('.');
    chain.push({ sel, w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), ox: cs.overflowX, pl: cs.paddingLeft, pr: cs.paddingRight, minW: cs.minWidth });
    el = el.parentElement;
  }
  return { vw: document.documentElement.clientWidth, chain };
})()`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: MOBILE });
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const r = await page.evaluate(script);
console.log('vw=', r.vw);
for (const c of r.chain) console.log(`w=${c.w} L=${c.left} R=${c.right} ox=${c.ox} pl=${c.pl} pr=${c.pr} minW=${c.minW} | ${c.sel}`);
await browser.close();
process.exit(0);
