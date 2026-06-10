import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PAGES = ['/', '/case-studies'];
const MOBILE = { width: 375, height: 667 };

const script = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      // Is any ancestor clipping overflow-x?
      let clipped = false;
      let p = el.parentElement;
      while (p) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') { clipped = true; break; }
        p = p.parentElement;
      }
      let sel = el.tagName.toLowerCase();
      if (el.id) sel += '#' + el.id;
      if (el.className && typeof el.className === 'string') {
        sel += '.' + el.className.trim().split(/\\s+/).slice(0,4).join('.');
      }
      out.push({ sel, right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width), clipped, text:(el.textContent||'').trim().slice(0,30) });
    }
  }
  // The real culprit: widest, NOT clipped by an ancestor
  const unclipped = out.filter(o => !o.clipped).sort((a,b)=>b.w-a.w);
  return { scrollWidth: document.documentElement.scrollWidth, vw, unclipped: unclipped.slice(0,10) };
})()`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: MOBILE });
const page = await ctx.newPage();
for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const r = await page.evaluate(script);
  console.log(`\n=== ${path} === scrollWidth=${r.scrollWidth} vw=${r.vw}`);
  console.log('UNCLIPPED offenders (true document wideners):');
  for (const o of r.unclipped) console.log(`  w=${o.w} right=${o.right} left=${o.left} | ${o.sel} | "${o.text}"`);
}
await browser.close();
process.exit(0);
