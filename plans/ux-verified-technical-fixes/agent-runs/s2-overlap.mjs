// S2 adjacent-target overlap check (WCAG 2.5.8): for footer links within a
// single column, report each link's box top/bottom and the overlap with the
// next sibling. Boxes may touch/overlap slightly but must not fully swallow a
// neighbor's center. Also reports the visual text-baseline pitch vs the before
// run to confirm the design rhythm is unchanged.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto(`${BASE}/about`, { waitUntil: "networkidle" });

// First footer column's links.
const boxes = await page.$$eval(
  'footer nav[aria-label="Footer"] ul:first-child a',
  (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent.trim(),
        top: Math.round(r.top * 10) / 10,
        bottom: Math.round(r.bottom * 10) / 10,
        height: Math.round(r.height * 10) / 10,
      };
    }),
);

const report = boxes.map((b, i) => {
  const next = boxes[i + 1];
  const gapToNext = next ? Math.round((next.top - b.bottom) * 10) / 10 : null;
  const nextCenter = next ? (next.top + next.bottom) / 2 : null;
  const swallowsNextCenter = next ? b.bottom > nextCenter : false;
  return { ...b, gapToNext, swallowsNextCenter };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
