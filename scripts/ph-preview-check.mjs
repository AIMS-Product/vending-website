// Usage: VERCEL_AUTOMATION_BYPASS_SECRET=… node scripts/ph-preview-check.mjs <origin>
// Loads /contact in headless Chromium, records every request to the PostHog
// proxy, focuses a form field, navigates away, and prints what PostHog would
// have received (event names + the stamped join properties).
import { chromium } from "playwright";
import { gunzipSync } from "node:zlib";

const origin = process.argv[2];
if (!origin) throw new Error("preview origin required");

const browser = await chromium.launch();
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : {},
});
const page = await context.newPage();
const hits = [];

function decodeBody(req) {
  const buf = req.postDataBuffer();
  if (!buf) return null;
  const url = new URL(req.url());
  let raw = buf;
  if (url.searchParams.get("compression") === "gzip-js") raw = gunzipSync(buf);
  const text = raw.toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    const m = /^data=(.*)$/.exec(text);
    if (m) return JSON.parse(Buffer.from(decodeURIComponent(m[1]), "base64").toString("utf8"));
    return text;
  }
}

page.on("response", async (res) => {
  const req = res.request();
  const url = new URL(req.url());
  if (!url.pathname.startsWith("/api/ph/")) return;
  let events = [];
  if (req.method() === "POST" && url.pathname.startsWith("/api/ph/e")) {
    const body = decodeBody(req);
    const list = Array.isArray(body) ? body : body?.batch ?? (body ? [body] : []);
    events = list.map((e) => ({
      event: e.event,
      vp_session_id: e.properties?.vp_session_id,
      source_path: e.properties?.source_path,
      page_group: e.properties?.page_group,
      environment: e.properties?.environment,
      form_id: e.properties?.form_id,
      first_field: e.properties?.first_field,
    }));
  }
  hits.push({ path: url.pathname, method: req.method(), status: res.status(), events });
});

await page.goto(`${origin}/contact?utm_source=phcheck`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const cookie = (await page.context().cookies()).find((c) => c.name === "vp_sid");
console.log("vp_sid cookie:", cookie ? cookie.value.slice(0, 12) + "…" : "MISSING");
const field = page.locator("form[data-form-step] input[name]:not([type=hidden])").first();
await field.scrollIntoViewIfNeeded();
await field.focus();
await field.fill("PostHog Check");
await page.locator("form[data-form-step] input[name=email]").first().focus(); // blur -> change
await page.waitForTimeout(1500);
await page.goto(`${origin}/about`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await browser.close();

const statuses = {};
for (const h of hits) statuses[`${h.method} ${h.path}`] = (statuses[`${h.method} ${h.path}`] ?? []).concat(h.status);
console.log("proxy hits:", JSON.stringify(statuses));
const events = hits.flatMap((h) => h.events);
console.log(`events captured: ${events.length}`);
for (const e of events) console.log(" ", JSON.stringify(e));
const missingJoin = events.filter((e) => !e.vp_session_id);
console.log(missingJoin.length === 0 ? "ALL events carry vp_session_id" : `MISSING vp_session_id on ${missingJoin.length} events`);
