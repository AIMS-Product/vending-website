// Crawls a running build and records what each web font actually draws:
// characters (after text-transform, list markers, pseudo-element content,
// form placeholders and `hyphens: auto`), weight/style pairs, OpenType
// features and variation settings, plus font bytes and preloads per page.
//
//   node scripts/fonts/audit-usage.mjs http://localhost:3000 > scripts/fonts/usage.json
//
// The page list is the sitemap plus the routes in EXTRA_PATHS (funnels and
// thank-you pages are not in the sitemap). Feed the JSON to subset-fonts.py.
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const EXTRA_PATHS = [
  "/apply",
  "/book-now",
  "/booking-ak-t5",
  "/booking-internal-ltf",
  "/booking-meta",
  "/booking-partner",
  "/booking-passivepreneurs",
  "/booking-reactivation-email",
  "/booking-t5-socials",
  "/booking-youtube",
  "/demo/book-a-call",
  "/funnel-plan",
  "/masterclass",
  "/masterclass-confirmed",
  "/masterclass-replay-adnb",
  "/masterclass-replay-advisory",
  "/masterclass-replay-dna",
  "/masterclass-replay-meta",
  "/masterclass-review",
  "/mike",
  "/newsletter",
  "/playbook",
  "/playbook/checkout",
  "/playbook/guide",
  "/playbook/guide-access",
  "/playbook/guide-thanks",
  "/playbook/thank-you",
  "/pre-call-resources",
  "/process",
  "/process/choose-machines",
  "/process/contract",
  "/process/find-locations",
  "/process/optimize",
  "/process/pitch",
  "/process/scale",
  "/process/select-products",
  "/qa",
  "/qa-links",
  "/resources/finance-templates",
  "/resources/finance-templates-thank-you",
  "/resources/roadmap",
  "/resources/roadmap-thank-you",
  "/solutions/coaching",
  "/solutions/equipment",
  "/solutions/financing",
  "/solutions/marketplace",
  "/solutions/national-contracts",
  "/solutions/partners",
  "/solutions/support",
  "/thank-you",
  "/thank-you-for-applying",
  "/vp-quiz",
  "/this-page-does-not-exist",
  // legacy lead pages (src/lib/content/legacy-routes.ts)
  "/booking-ig",
  "/booking-x",
  "/booking-modern-entrepreneur-newsletter",
  "/book-my-advisory-call-setter",
  "/book-my-advisory-call-l1-topcl",
  "/book-my-advisory-call-l1",
  "/booking-vendingpreneurs-training",
  "/schedule-your-call-ig",
  "/book-your-call",
  "/start",
  "/start-your-route-ak-tt",
  "/vending-route-blueprint",
  "/vending-business-blueprint",
];

async function sitemapPaths() {
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => new URL(m[1]).pathname,
  );
}

// Runs in the page. Returns per-family usage keyed by the first family in the
// computed font-family list (the face the browser tries first).
function collect() {
  const out = {};
  const MARKERS = {
    disc: "•",
    circle: "◦",
    square: "▪",
    "disclosure-closed": "▸",
    "disclosure-open": "▾",
  };
  const family = (cs) =>
    cs.fontFamily
      .split(",")[0]
      .trim()
      .replace(/^["']|["']$/g, "");
  const transform = (text, cs) => {
    const t = cs.textTransform;
    if (t === "uppercase") return text.toLocaleUpperCase("en");
    if (t === "lowercase") return text.toLocaleLowerCase("en");
    if (t === "capitalize") return text + text.toLocaleUpperCase("en");
    return text;
  };
  const record = (cs, text) => {
    if (!text || !text.trim()) return;
    const f = (out[family(cs)] ??= {
      chars: {},
      styles: {},
      features: {},
      variations: {},
      hyphensAuto: 0,
      ellipsis: 0,
    });
    for (const ch of transform(text, cs)) f.chars[ch] = (f.chars[ch] ?? 0) + 1;
    const key = `${cs.fontWeight} ${cs.fontStyle}`;
    f.styles[key] = (f.styles[key] ?? 0) + 1;
    const feats = [
      cs.fontFeatureSettings !== "normal" && `ffs:${cs.fontFeatureSettings}`,
      cs.fontVariantNumeric !== "normal" && `num:${cs.fontVariantNumeric}`,
      cs.fontVariantLigatures !== "normal" && `lig:${cs.fontVariantLigatures}`,
      cs.fontVariantCaps !== "normal" && `caps:${cs.fontVariantCaps}`,
      cs.fontVariantEastAsian !== "normal" && `ea:${cs.fontVariantEastAsian}`,
      cs.fontVariantPosition &&
        cs.fontVariantPosition !== "normal" &&
        `pos:${cs.fontVariantPosition}`,
      cs.fontKerning !== "auto" && `kern:${cs.fontKerning}`,
      cs.fontOpticalSizing &&
        cs.fontOpticalSizing !== "auto" &&
        `opsz:${cs.fontOpticalSizing}`,
      cs.fontSynthesis && `synth:${cs.fontSynthesis}`,
      cs.fontStretch !== "100%" && `stretch:${cs.fontStretch}`,
    ].filter(Boolean);
    for (const k of feats) f.features[k] = (f.features[k] ?? 0) + 1;
    if (cs.fontVariationSettings !== "normal")
      f.variations[cs.fontVariationSettings] = 1;
    if (cs.hyphens === "auto") f.hyphensAuto++;
    if (cs.textOverflow === "ellipsis") f.ellipsis++;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName))
      continue;
    const cs = getComputedStyle(el);
    record(cs, n.data);
    if (cs.hyphens === "auto") record(cs, "‐");
    if (cs.textOverflow === "ellipsis") record(cs, "…");
    // A non-English lang turns on language-specific forms (locl).
    const lang = el.closest("[lang]")?.getAttribute("lang") ?? "";
    const f = out[family(cs)];
    if (f && !lang.startsWith("en")) f.features[`lang:${lang}`] = 1;
  }
  for (const el of document.body.querySelectorAll("*")) {
    for (const pseudo of ["::before", "::after", "::marker", "::placeholder"]) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo === "::marker") {
        if (getComputedStyle(el).display !== "list-item") continue;
        const t = cs.listStyleType ?? getComputedStyle(el).listStyleType;
        record(cs, MARKERS[t] ?? (t === "none" ? "" : "0123456789. "));
        continue;
      }
      if (pseudo === "::placeholder") {
        if (el.placeholder) record(cs, el.placeholder);
        continue;
      }
      const c = cs.content;
      if (c && c !== "none" && c !== "normal" && c.startsWith('"'))
        record(cs, JSON.parse(c));
      if (c && c.includes("quote")) record(cs, "“”‘’");
    }
    if (
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA") &&
      el.value &&
      el.type !== "hidden"
    )
      record(getComputedStyle(el), el.value);
    if (el.tagName === "SELECT")
      for (const o of el.options) record(getComputedStyle(el), o.text);
  }
  const preloads = [
    ...document.querySelectorAll('link[rel="preload"][as="font"]'),
  ].map((l) => new URL(l.href).pathname);
  return { usage: out, preloads };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const paths = [...new Set([...(await sitemapPaths()), ...EXTRA_PATHS])];
const pages = [];
for (const path of paths) {
  const page = await ctx.newPage();
  const fonts = [];
  page.on("request", (r) => {
    if (r.resourceType() === "font") fonts.push(new URL(r.url()).pathname);
  });
  const res = await page.goto(base + path, {
    waitUntil: "load",
    timeout: 60000,
  });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
  });
  // Embeds (Stripe, Calendly, video) keep connections open, so networkidle
  // never fires on some pages; fonts settle well inside this window.
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.fonts.ready);
  const { usage, preloads } = await page.evaluate(collect);
  pages.push({ path, status: res?.status() ?? 0, fonts, preloads, usage });
  console.error(
    `${res?.status()} ${path} fonts=${fonts.length} preloads=${preloads.length}`,
  );
  await page.close();
}
await browser.close();
// Sizes are read once per file after the crawl: response bodies of cached
// fonts are not always retrievable from the page.
const sizes = {};
for (const url of new Set(pages.flatMap((p) => p.fonts))) {
  sizes[url] = (await (await fetch(base + url)).arrayBuffer()).byteLength;
}
for (const p of pages) {
  p.fonts = [...new Set(p.fonts)].map((url) => ({ url, bytes: sizes[url] }));
  p.fontBytes = p.fonts.reduce((n, f) => n + f.bytes, 0);
}
console.log(
  JSON.stringify({ base, crawledAt: new Date().toISOString(), pages }, null, 1),
);
