import { chromium } from "playwright";

const PHASE = process.argv[2] ?? "before";
const SHOTS_DIR = new URL("./shots/", import.meta.url).pathname;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto("http://localhost:3000/admin/pages", {
  waitUntil: "networkidle",
});

// Wait for the desktop table to be present.
await page.waitForSelector("table");

// Collect the interactive elements inside list rows that S3 cares about:
//  - bulk-select checkbox (input[name="ids"])
//  - the "⋮" per-row actions menu summary (details > summary)
//  - the title link (first link in each row's title cell)
// The status/readiness dots are decorative spans (aria-hidden) inside a
// non-interactive <span> StatusBadge — they are intentionally NOT measured.

const measurements = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll("table tbody tr"));
  const results = [];

  rows.forEach((row, rowIndex) => {
    const checkbox = row.querySelector('input[name="ids"]');
    if (checkbox) {
      // The visual box is the <input>; the actual hit target is the
      // enclosing <label> (or the input itself if unwrapped). Measure the
      // hit target since WCAG 2.5.8 governs the clickable area.
      const hit = checkbox.closest("label") ?? checkbox;
      const r = hit.getBoundingClientRect();
      const visual = checkbox.getBoundingClientRect();
      results.push({
        row: rowIndex,
        element: "bulk-select checkbox (hit target)",
        width: Math.round(r.width * 100) / 100,
        height: Math.round(r.height * 100) / 100,
        visualWidth: Math.round(visual.width * 100) / 100,
        visualHeight: Math.round(visual.height * 100) / 100,
      });
    }

    const summary = row.querySelector("details > summary");
    if (summary) {
      const r = summary.getBoundingClientRect();
      results.push({
        row: rowIndex,
        element: "actions menu (⋮) summary",
        width: Math.round(r.width * 100) / 100,
        height: Math.round(r.height * 100) / 100,
      });
    }

    const titleLink = row.querySelector('td a[href^="/admin/pages/"]');
    if (titleLink) {
      const r = titleLink.getBoundingClientRect();
      results.push({
        row: rowIndex,
        element: "title link",
        width: Math.round(r.width * 100) / 100,
        height: Math.round(r.height * 100) / 100,
      });
    }
  });

  // Also confirm status dots are non-interactive (no button/anchor/role).
  const dots = Array.from(
    document.querySelectorAll("table tbody .rounded-full"),
  );
  const interactiveDots = dots.filter((d) => {
    const tag = d.tagName.toLowerCase();
    const role = d.getAttribute("role");
    return (
      tag === "button" ||
      tag === "a" ||
      role === "button" ||
      role === "link" ||
      d.closest("button") ||
      d.closest("a")
    );
  });

  return { results, dotCount: dots.length, interactiveDots: interactiveDots.length };
});

console.log(JSON.stringify({ phase: PHASE, ...measurements }, null, 2));

await page.screenshot({
  path: `${SHOTS_DIR}s3-${PHASE}-table.png`,
  clip: { x: 0, y: 0, width: 1440, height: 700 },
});

await browser.close();
