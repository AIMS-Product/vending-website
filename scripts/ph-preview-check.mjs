// Usage: VERCEL_AUTOMATION_BYPASS_SECRET=… node scripts/ph-preview-check.mjs <origin>
// Loads /contact in headless Chromium, records every request to the PostHog
// proxy, focuses a form field, navigates away, and prints what PostHog would
// have received (event names + the stamped join properties).
import { chromium } from "playwright";
import { gunzipSync } from "node:zlib";

const origin = process.argv[2];
if (!origin) throw new Error("preview origin required");

// posthog-js drops every capture when it thinks the browser is a bot: a
// "HeadlessChrome" user agent, matching userAgentData brands, or
// navigator.webdriver. Present a normal Chrome or nothing is ever sent.
const browser = await chromium.launch({
  args: ["--disable-blink-features=AutomationControlled"],
});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : {},
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => false });
  Object.defineProperty(navigator, "userAgentData", { get: () => undefined });
  // Playwright cannot read sendBeacon bodies (`form_abandoned`, `$pageleave`
  // travel that way), so mirror each one to the console as base64.
  const send = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = (url, data) => {
    const blob = data instanceof Blob ? data : new Blob([data]);
    blob.arrayBuffer().then((buf) => {
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      console.log(`__beacon__ ${url} ${btoa(bin)}`);
    });
    return send(url, data);
  };
});
const page = await context.newPage();
const hits = [];
const beaconEvents = [];
page.on("console", (msg) => {
  const m = /^__beacon__ (\S+) (\S*)$/.exec(msg.text());
  if (!m) return;
  const url = new URL(m[1], origin);
  if (!url.pathname.startsWith("/api/ph/")) return;
  const buf = Buffer.from(m[2], "base64");
  const raw = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
  let body;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return;
  }
  const list = Array.isArray(body) ? body : (body?.batch ?? [body]);
  for (const e of list)
    beaconEvents.push({ via: "beacon", path: url.pathname, ...summarize(e) });
});

function summarize(e) {
  return {
    event: e.event,
    vp_session_id: e.properties?.vp_session_id,
    source_path: e.properties?.source_path,
    page_group: e.properties?.page_group,
    environment: e.properties?.environment,
    form_id: e.properties?.form_id,
    first_field: e.properties?.first_field,
    last_field: e.properties?.last_field,
  };
}

function decodeBody(req) {
  const buf = req.postDataBuffer();
  if (!buf) return null;
  const url = new URL(req.url());
  // posthog-js gzips the batch without announcing it in the query string, so
  // sniff the gzip magic bytes instead of trusting `compression=gzip-js`.
  const gzipped =
    (buf[0] === 0x1f && buf[1] === 0x8b) ||
    url.searchParams.get("compression") === "gzip-js";
  const raw = gzipped ? gunzipSync(buf) : buf;
  const text = raw.toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    const m = /^data=(.*)$/.exec(text);
    if (m)
      return JSON.parse(
        Buffer.from(decodeURIComponent(m[1]), "base64").toString("utf8"),
      );
    return text;
  }
}

// Record on request, not response: the pagehide beacons (`$pageleave`,
// `form_abandoned`) go out while the page is being torn down and their
// responses may never be reported.
page.on("request", (req) => {
  const url = new URL(req.url());
  if (!url.pathname.startsWith("/api/ph/")) return;
  let events = [];
  // Events land on /e/ and, since flags started announcing it, on /i/v0/e/.
  if (
    req.method() === "POST" &&
    /^\/api\/ph\/(i\/v0\/)?e\//.test(url.pathname)
  ) {
    const body = decodeBody(req);
    const list = Array.isArray(body)
      ? body
      : (body?.batch ?? (body ? [body] : []));
    events = list.map(summarize);
  }
  hits.push({ path: url.pathname, method: req.method(), req, events });
});

await page.goto(`${origin}/contact?utm_source=phcheck`, {
  waitUntil: "networkidle",
});
await page.waitForTimeout(4000);
const cookie = (await page.context().cookies()).find(
  (c) => c.name === "vp_sid",
);
console.log(
  "vp_sid cookie:",
  cookie ? cookie.value.slice(0, 12) + "…" : "MISSING",
);
const field = page
  .locator("form[data-form-step] input[name]:not([type=hidden])")
  .first();
await field.scrollIntoViewIfNeeded();
await field.focus();
await field.fill("PostHog Check");
await page.locator("form[data-form-step] input[name=email]").first().focus(); // blur -> change
await page.waitForTimeout(4000);
// Leave by a client-side navigation first (the FormTracker's pathname effect
// fires `form_abandoned` through the normal queue, so its body is readable),
// then by a full load, whose pagehide beacons are visible only as "sent".
const internalLink = page
  .locator('a[href^="/"]:not([href^="/contact"]):not([href^="/#"])')
  .first();
if (await internalLink.count()) {
  const href = await internalLink.getAttribute("href");
  await internalLink.click();
  await page.waitForURL((u) => u.pathname === href, { timeout: 10_000 });
  await page.waitForTimeout(4000);
}
await page.goto(`${origin}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
for (const h of hits) {
  const res = await h.req.response().catch(() => null);
  h.status = res ? res.status() : "sent";
}
await browser.close();

const statuses = {};
for (const h of hits)
  statuses[`${h.method} ${h.path}`] = (
    statuses[`${h.method} ${h.path}`] ?? []
  ).concat(h.status);
console.log("proxy hits:", JSON.stringify(statuses));
const events = hits.flatMap((h) => h.events).concat(beaconEvents);
console.log(`events captured: ${events.length}`);
for (const e of events) console.log(" ", JSON.stringify(e));
const missingJoin = events.filter((e) => !e.vp_session_id);
console.log(
  missingJoin.length === 0
    ? "ALL events carry vp_session_id"
    : `MISSING vp_session_id on ${missingJoin.length} events`,
);
