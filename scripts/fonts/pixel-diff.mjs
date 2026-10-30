// Pixel-diffs two running builds of the site, page by page, to prove a font
// change renders identically. Run the baseline build on one port and the
// candidate on another, against the same database (same content):
//
//   node scripts/fonts/pixel-diff.mjs http://localhost:3101 http://localhost:3102 /tmp/font-diff
//
// Each page is shot twice on the baseline (to measure the page's own noise:
// clocks, rotating testimonials, video posters) and once on the candidate.
// A pixel counts as a regression only if it differs from both baseline shots.
// A fixture block (every Latin-1 / Latin Extended-A letter, code, CJK,
// italics, bold inside italics, other scripts) is inserted at the top of
// <main> on the pages in FIXTURE_ON.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const [baseUrl, newUrl, outDir = "/tmp/font-diff"] = process.argv.slice(2);
if (!baseUrl || !newUrl)
  throw new Error("usage: pixel-diff.mjs <base-url> <new-url> [out-dir]");

const ALL_PAGES = [
  "/",
  "/about",
  "/apply",
  "/book-now",
  "/masterclass",
  "/masterclass-confirmed",
  "/masterclass-replay-advisory",
  "/playbook",
  "/playbook/guide",
  "/qa",
  "/mike",
  "/resources/vending-in-colleges",
  "/resources/combo-vending-machine",
  "/resources/finance-templates",
  "/news/best-vending-locations",
  "/news/how-much-money-do-vending-machines-make-2026",
  "/case-studies/jesse-lee",
  "/case-studies",
  "/pre-call-resources",
  "/process/pitch",
  "/solutions/vendscout",
  "/contact",
  "/vp-quiz",
  "/booking-ig",
  "/privacy",
];
// FONT_DIFF_PAGES=/,/mike limits a run to some pages.
const PAGES = process.env.FONT_DIFF_PAGES?.split(",") ?? ALL_PAGES;
// FONT_DIFF_NO_FIXTURE=1 shoots the pages as they are (the fixture changes
// page height by a fraction of a pixel, which shifts everything below it).
const FIXTURE_ON = process.env.FONT_DIFF_NO_FIXTURE ? {} : {
  "/": ["var(--font-sans)", '"Anton", "Anton Fallback"'],
  "/mike": ["GeistBio"],
};
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const latin = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) =>
    String.fromCodePoint(from + i),
  ).join("");
function fixture(families) {
  const lines = [
    "The quick brown fox jumps over the lazy dog 0123456789 AVATAR Wa To Ty",
    latin(0xa1, 0xff),
    latin(0x100, 0x17f),
    "“Quotes” ‘single’ — en–dash … • · © › → ↗ ▸ ▾ − ↓ ≥ ≈ ↔",
    "calt: 12:30 A-B A–B ->  <- (HELLO) [X] {Y} @TAG 1x2",
    "Café résumé naïve Ångström Œuvre Łódź Šeširi ğüşiöç",
    "Привет мир · Γειά σου · Tiếng Việt · 日本語 中文 한국어",
  ];
  const rows = families.flatMap((family) =>
    [400, 500, 600, 700, 800, 900]
      .flatMap((w) => [
        `<p style="font-family:${family};font-weight:${w};margin:2px 0">${w}: ${lines.join(" | ")}</p>`,
        `<p style="font-family:${family};font-weight:${w};font-style:italic;margin:2px 0">${w} italic: ${lines[0]} <b>bold in italic</b> <strong>${lines[4]}</strong></p>`,
      ])
      .concat([
        `<p style="font-family:${family};font-variant-numeric:tabular-nums">tabular 1111 / 0000 / 1234567890 $5,000-$60,000</p>`,
        `<p style="font-family:${family}"><code>const x = "code() => 0"; // mono</code> <kbd>Ctrl+K</kbd></p>`,
      ]),
  );
  return `<section id="font-fixture" style="padding:16px;background:#fff;color:#111;font-size:15px;line-height:1.5;overflow-wrap:anywhere">${rows.join("")}</section>`;
}

async function shoot(browser, origin, path, vp) {
  const ctx = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const families = FIXTURE_ON[path];
  // React discards nodes injected into the server HTML when it hydrates, so
  // the fixture goes in after load, on the warm-up load (to cache the faces it
  // needs) and again on the measured load.
  const load = async () => {
    await page.goto(origin + path, { waitUntil: "load", timeout: 60000 });
    if (families) {
      await page.evaluate((html) => document.querySelector("main").insertAdjacentHTML("afterbegin", html), fixture(families));
    }
    await page.evaluate(() => document.fonts.ready);
  };
  // Warm the cache first: Inter is `font-display: optional`, so a file that
  // is not preloaded (the extended subsets, before and after) is skipped on a
  // cold load if it misses the ~100ms window. Shooting the second load makes
  // every face render, so the diff compares glyphs, not network timing.
  await load();
  await page.waitForTimeout(500);
  await load();
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.waitForTimeout(1500);
  // Iframes (Calendly, Vidalytics, YouTube) and videos load third-party
  // content that changes per request; hide them so the diff measures our text.
  await page.addStyleTag({
    content:
      "iframe,video{visibility:hidden!important} *{caret-color:transparent!important}",
  });
  const png = await page.screenshot({ fullPage: true, animations: "disabled" });
  const faces = await page.evaluate(() =>
    [...document.fonts]
      .filter((f) => f.status === "loaded")
      .map((f) => `${f.family} ${f.weight} ${f.unicodeRange.slice(0, 18)}`),
  );
  await ctx.close();
  return { png, faces };
}

async function raw(png) {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function diffMask(a, b) {
  const w = Math.min(a.w, b.w),
    h = Math.min(a.h, b.h);
  const mask = new Uint8Array(w * h);
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * a.w + x) * 4,
        j = (y * b.w + x) * 4;
      if (
        a.data[i] !== b.data[j] ||
        a.data[i + 1] !== b.data[j + 1] ||
        a.data[i + 2] !== b.data[j + 2]
      ) {
        mask[y * w + x] = 1;
        n++;
      }
    }
  return { mask, w, h, n, sizeDiffers: a.w !== b.w || a.h !== b.h };
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const path of PAGES) {
  for (const vp of VIEWPORTS) {
    const b1 = await shoot(browser, baseUrl, path, vp);
    const nw = await shoot(browser, newUrl, path, vp);
    const b2 = await shoot(browser, baseUrl, path, vp);
    const [B1, N, B2] = await Promise.all([
      raw(b1.png),
      raw(nw.png),
      raw(b2.png),
    ]);
    const noise = diffMask(B1, B2);
    const d1 = diffMask(B1, N),
      d2 = diffMask(B2, N);
    // Regression pixels: differ from both baseline shots.
    let reg = 0;
    const w = Math.min(d1.w, d2.w),
      h = Math.min(d1.h, d2.h);
    const box = { x0: w, y0: h, x1: -1, y1: -1 };
    const overlay = Buffer.from(N.data.subarray(0, N.w * h * 4));
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (d1.mask[y * d1.w + x] && d2.mask[y * d2.w + x]) {
          reg++;
          box.x0 = Math.min(box.x0, x);
          box.y0 = Math.min(box.y0, y);
          box.x1 = Math.max(box.x1, x);
          box.y1 = Math.max(box.y1, y);
          const k = (y * N.w + x) * 4;
          overlay[k] = 255;
          overlay[k + 1] = 0;
          overlay[k + 2] = 255;
        }
      }
    const slug = `${path.replace(/\W+/g, "_") || "_root"}-${vp.name}`;
    const r = {
      page: path,
      viewport: vp.name,
      height: { base: B1.h, base2: B2.h, new: N.h },
      noisePixels: noise.n,
      baseVsNew: d1.n,
      regressionPixels: reg,
      regressionBox: reg ? box : null,
      facesBase: b1.faces,
      facesNew: nw.faces,
    };
    if (reg || d1.sizeDiffers) {
      writeFileSync(`${outDir}/${slug}-base.png`, b1.png);
      writeFileSync(`${outDir}/${slug}-new.png`, nw.png);
      await sharp(overlay, { raw: { width: N.w, height: h, channels: 4 } })
        .png()
        .toFile(`${outDir}/${slug}-diff.png`);
    }
    results.push(r);
    console.error(
      `${reg ? "DIFF" : "same"} ${path} ${vp.name} noise=${noise.n} base-vs-new=${d1.n} regression=${reg} h=${B1.h}/${B2.h}/${N.h}`,
    );
  }
}
await browser.close();
writeFileSync(`${outDir}/results.json`, JSON.stringify(results, null, 1));
