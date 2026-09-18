#!/usr/bin/env node
/**
 * Reconciles our stored session counts against GA4 itself.
 *
 * The dashboard's every opt-in rate divides by our `ga4_page_views` sessions.
 * A week measured by hand in the GA4 UI came out 59% below ours, which would
 * mean every conversion rate we have shown is understated. This asks GA4 the
 * same questions the UI asks -- Traffic acquisition (sessions by channel
 * group) and Landing page (sessions by landing page) -- through the same Data
 * API the sync uses, and puts them beside our own tables for one date range.
 *
 * Reading GA4 through the API rather than a UI export also settles the
 * internal-traffic question: property data filters apply to the API too, so if
 * the API total matches the UI total, filtering is not the gap.
 *
 * Usage: node scripts/ga4-reconcile.mjs [--start 2026-09-11] [--end 2026-09-17]
 */

import fs from "node:fs";
import path from "node:path";
import { createSign } from "node:crypto";
import { createJiti } from "jiti";

const ROOT = process.cwd();
const env = readEnv(path.join(ROOT, ".env.local"));
for (const [name, value] of Object.entries(env)) process.env[name] ??= value;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const propertyId = process.env.GA4_PROPERTY_ID;
const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
if (!url || !key || !propertyId || !serviceAccountJson) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_JSON.");
  process.exit(1);
}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": path.join(ROOT, "src"),
    "server-only": path.join(ROOT, "vitest.server-only-shim.ts"),
  },
  interopDefault: true,
});
const { parseServiceAccount } = await jiti.import(path.join(ROOT, "src/lib/ga4/client.ts"));
const { resolveGa4Channel } = await jiti.import(path.join(ROOT, "src/lib/analytics/channel.ts"));

const startDate = argValue("--start") ?? "2026-09-11";
const endDate = argValue("--end") ?? "2026-09-17";

const account = parseServiceAccount(serviceAccountJson);
if (!account) {
  console.error("GA4 service account key is unreadable.");
  process.exit(1);
}

const token = await accessToken(account);

// --- GA4, asked the same questions the UI asks -----------------------------
const [total, byChannelGroup, byLandingPage, ourDimensions] = await Promise.all([
  ga4([], ["sessions", "screenPageViews", "totalUsers"]),
  ga4(["sessionDefaultChannelGroup"], ["sessions"]),
  ga4(["landingPage"], ["sessions"]),
  // The sync's own report shape, to see whether these four dimensions split a
  // session across rows the way the UI's one dimension cannot.
  ga4(["date", "landingPage", "sessionCampaignName", "sessionSource"], ["sessions", "screenPageViews"]),
]);

// --- Ours ------------------------------------------------------------------
const stored = await read(
  "ga4_page_views",
  "day,landing_page,utm_campaign,utm_source,sessions,screen_page_views",
  `day=gte.${startDate}&day=lte.${endDate}`,
);
const channelDaily = await read("channel_daily", "day,source,medium,campaign,visits", `day=gte.${startDate}&day=lte.${endDate}`);

const storedSessions = sum(stored, (r) => r.sessions);
const storedViews = sum(stored, (r) => r.screen_page_views);
const apiTotalSessions = metric(total, 0);
const apiTotalViews = metric(total, 1);

line();
console.log(`GA4 reconciliation  ${startDate} -> ${endDate}   property ${propertyId}`);
line();
console.log("GA4 Data API, no dimensions (the ground truth):");
console.log(`  sessions          ${fmt(apiTotalSessions)}`);
console.log(`  screenPageViews   ${fmt(apiTotalViews)}`);
console.log(`  totalUsers        ${fmt(metric(total, 2))}`);
console.log("");
console.log("GA4 Traffic acquisition (sessions by Session primary channel group):");
for (const row of rows(byChannelGroup)) {
  console.log(`  ${row.dims[0].padEnd(22)} ${fmt(row.metrics[0]).padStart(8)}`);
}
console.log(`  ${"TOTAL".padEnd(22)} ${fmt(sum(rows(byChannelGroup), (r) => r.metrics[0])).padStart(8)}`);
console.log("");
console.log("GA4 Landing page (sessions):");
console.log(`  rows              ${rows(byLandingPage).length}`);
console.log(`  TOTAL             ${fmt(sum(rows(byLandingPage), (r) => r.metrics[0]))}`);
console.log("");
console.log("GA4, the sync's own four dimensions (date, landingPage, campaign, source):");
console.log(`  rows              ${rows(ourDimensions).length}`);
console.log(`  sessions summed   ${fmt(sum(rows(ourDimensions), (r) => r.metrics[0]))}`);
console.log(`  pageViews summed  ${fmt(sum(rows(ourDimensions), (r) => r.metrics[1]))}`);
line();
console.log("Ours, ga4_page_views:");
console.log(`  rows              ${stored.length}`);
console.log(`  sessions summed   ${fmt(storedSessions)}`);
console.log(`  pageViews summed  ${fmt(storedViews)}`);
console.log(`  channel_daily.visits summed  ${fmt(sum(channelDaily, (r) => r.visits))} over ${channelDaily.length} rows`);
line();
console.log("Ours by resolveGa4Channel (from ga4_page_views.sessions):");
const byChannel = new Map();
for (const row of stored) {
  const channel = resolveGa4Channel(row.utm_source, row.utm_campaign).channel;
  byChannel.set(channel, (byChannel.get(channel) ?? 0) + row.sessions);
}
for (const [channel, sessions] of [...byChannel].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${channel.padEnd(22)} ${fmt(sessions).padStart(8)}`);
}
line();
console.log("VERDICT");
verdict("stored sessions vs GA4 API total", storedSessions, apiTotalSessions);
verdict("stored sessions vs GA4 landing-page total", storedSessions, sum(rows(byLandingPage), (r) => r.metrics[0]));
verdict("stored pageViews vs GA4 API pageViews", storedViews, apiTotalViews);
verdict("GA4 four-dimension sum vs GA4 API total", sum(rows(ourDimensions), (r) => r.metrics[0]), apiTotalSessions);
line();

function verdict(label, ours, theirs) {
  const delta = theirs === 0 ? null : ((ours - theirs) / theirs) * 100;
  const mark = delta === null ? "?" : Math.abs(delta) < 0.5 ? "MATCH" : "DIFF";
  console.log(
    `  ${mark.padEnd(6)} ${label.padEnd(46)} ${fmt(ours).padStart(8)} vs ${fmt(theirs).padStart(8)}` +
      (delta === null ? "" : `   ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`),
  );
}

async function ga4(dimensions, metrics) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map((name) => ({ name })),
        metrics: metrics.map((name) => ({ name })),
        metricAggregations: ["TOTAL"],
        limit: 10000,
      }),
    },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`GA4 ${dimensions.join("+") || "(total)"}: ${response.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function rows(payload) {
  return (payload.rows ?? []).map((row) => ({
    dims: (row.dimensionValues ?? []).map((cell) => String(cell.value ?? "")),
    metrics: (row.metricValues ?? []).map((cell) => Number(cell.value ?? 0)),
  }));
}

function metric(payload, index) {
  return Number(payload.totals?.[0]?.metricValues?.[index]?.value ?? 0);
}

async function accessToken(acct) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64(
    JSON.stringify({
      iss: acct.clientEmail,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: acct.tokenUri,
      exp: issuedAt + 3600,
      iat: issuedAt,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${b64(signer.sign(acct.privateKey))}`;
  const response = await fetch(acct.tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  // No body in the message: a failed exchange echoes back the signed assertion.
  if (!response.ok) throw new Error(`GA4 token exchange failed with HTTP ${response.status}.`);
  const body = JSON.parse(await response.text());
  return body.access_token;
}

function b64(value) {
  return (typeof value === "string" ? Buffer.from(value) : value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function read(table, select, filter) {
  const out = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&${filter}&order=day`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
    const batch = await response.json();
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

function sum(list, pick) {
  return list.reduce((total, item) => total + (pick(item) ?? 0), 0);
}
function fmt(value) {
  return Math.round(value).toLocaleString("en-US");
}
function line() {
  console.log("-".repeat(78));
}
function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const at = l.indexOf("=");
        return [l.slice(0, at).trim(), l.slice(at + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}
function argValue(flag) {
  const at = process.argv.indexOf(flag);
  return at === -1 ? null : process.argv[at + 1];
}
