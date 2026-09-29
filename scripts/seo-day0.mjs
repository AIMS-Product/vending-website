#!/usr/bin/env node
/**
 * Freezes the SEO Day 0 baseline into seo_baselines.
 *
 * Usage: node --env-file=.env.local scripts/seo-day0.mjs [--day YYYY-MM-DD] [--write]
 * Dry run by default (prints the values). --write inserts with
 * ignoreDuplicates, so a value already frozen is never overwritten; re-run it
 * after the first full DataForSEO pull to add the rank metrics.
 *
 * Reads the Search Console tables and rank snapshots (src/lib/services/seo-scorecard.ts),
 * plus three live sources only this script asks: GA4 organic sessions and key
 * events, Search Console URL Inspection over the sitemap, and the newest
 * social follower counts.
 */
import path from "node:path";
import { createJiti } from "jiti";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const SITE = "https://www.vendingpreneurs.com";
const VP_BRAND = "6626386"; // Metricool Vendingpreneurs brand (AGENTS.md)
const args = process.argv.slice(2);
const write = args.includes("--write");
const dayArg =
  args[args.indexOf("--day") + 1]?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0];

for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GA4_SERVICE_ACCOUNT_JSON",
  "GA4_PROPERTY_ID",
  "GSC_SITE_URL",
]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}.`);
    process.exit(1);
  }
}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": path.join(ROOT, "src"),
    "server-only": path.join(ROOT, "vitest.server-only-shim.ts"),
  },
  interopDefault: true,
});
const { readScorecardMetrics, rankCounts } = await jiti.import(
  path.join(ROOT, "src/lib/services/seo-scorecard.ts"),
);
const { parseServiceAccount, serviceAccountToken } = await jiti.import(
  path.join(ROOT, "src/lib/ga4/client.ts"),
);

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
// A re-run adds to the frozen Day 0 (the Overview reads the earliest day)
// instead of starting a second baseline, unless --day says otherwise.
const frozen = await db.from("seo_baselines").select("day").order("day").limit(1);
if (frozen.error && !/does not exist|Could not find the table/.test(frozen.error.message)) {
  throw new Error(`seo_baselines read failed: ${frozen.error.message}`);
}
const day =
  dayArg ??
  frozen.data?.[0]?.day ??
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const account = parseServiceAccount(process.env.GA4_SERVICE_ACCOUNT_JSON);
const token = (scope) =>
  serviceAccountToken(account, scope, { fetchImpl: fetch, now: Date.now })();

async function json(res, what) {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${what} failed with HTTP ${res.status}: ${body?.error?.message ?? ""}`);
  }
  return body;
}

async function ga4Organic(asOf) {
  const t = await token("https://www.googleapis.com/auth/analytics.readonly");
  const start = new Date(`${asOf}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 27);
  const body = await json(
    await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA4_PROPERTY_ID}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: start.toISOString().slice(0, 10), endDate: asOf }],
          metrics: [{ name: "sessions" }, { name: "keyEvents" }],
          dimensionFilter: {
            filter: {
              fieldName: "sessionDefaultChannelGroup",
              stringFilter: { value: "Organic Search" },
            },
          },
        }),
      },
    ),
    "GA4 organic report",
  );
  const v = body.rows?.[0]?.metricValues ?? [];
  return {
    ga4_organic_sessions_28d: Number(v[0]?.value ?? 0),
    ga4_organic_key_events_28d: Number(v[1]?.value ?? 0),
  };
}

async function indexCoverage() {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const t = await token("https://www.googleapis.com/auth/webmasters.readonly");
  const detail = {};
  let indexed = 0;
  let resourcesIndexed = 0;
  for (const url of urls) {
    const body = await json(
      await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: process.env.GSC_SITE_URL }),
      }),
      `URL Inspection ${url}`,
    );
    const status = body.inspectionResult?.indexStatusResult;
    detail[url.replace(SITE, "") || "/"] = status?.coverageState ?? "unknown";
    if (status?.verdict === "PASS") {
      indexed += 1;
      if (url.includes("/resources/")) resourcesIndexed += 1;
    }
  }
  return {
    values: { indexed_urls: indexed, resources_indexed: resourcesIndexed },
    detail: { sitemapUrls: urls.length, coverage: detail },
  };
}

async function socialFollowers() {
  const { data, error } = await db
    .from("social_account_daily")
    .select("day, network, followers")
    .eq("brand_id", VP_BRAND)
    .not("followers", "is", null)
    .order("day", { ascending: false })
    .limit(500);
  if (error) throw new Error(`social_account_daily read failed: ${error.message}`);
  const latest = {};
  for (const r of data) latest[r.network] ??= r;
  return latest;
}

const { asOf, values } = await readScorecardMetrics(db);
if (!asOf) {
  console.error("No Search Console days in seo_gsc_daily; run the sync first.");
  process.exit(1);
}
const rows = [];
const addRow = (metric, value, detail = {}) =>
  rows.push({ day, metric, value, detail: { asOf, ...detail } });

// Rank metrics count only once a full pull covers the tracked list; a partial
// pull (the 73-keyword trial run) would freeze a wrong baseline.
const tracked = await db
  .from("seo_keywords")
  .select("keyword", { count: "exact", head: true })
  .eq("tracked", true);
if (tracked.error) throw new Error(`seo_keywords read failed: ${tracked.error.message}`);
const rankKeys = Object.keys(rankCounts([]));
const fullPull = (values.keywords_checked ?? 0) >= 0.9 * (tracked.count ?? 0);
for (const [metric, value] of Object.entries(values)) {
  if (rankKeys.includes(metric) && !fullPull) continue;
  addRow(metric, value, rankKeys.includes(metric) ? { tracked: tracked.count } : {});
}
if (!fullPull) {
  console.warn(
    `Rank metrics skipped: the newest pull covers ${values.keywords_checked ?? 0} of ${tracked.count} tracked keywords. Re-run after the full pull.`,
  );
}
for (const [metric, value] of Object.entries(await ga4Organic(asOf))) {
  addRow(metric, value);
}
const coverage = await indexCoverage();
for (const [metric, value] of Object.entries(coverage.values)) {
  addRow(metric, value, coverage.detail);
}
for (const [network, r] of Object.entries(await socialFollowers())) {
  addRow(`social_followers_${network}`, r.followers, { seenOn: r.day });
}

for (const r of rows) console.log(r.metric.padEnd(34), r.value);
if (!write) {
  console.log(`\nDry run for Day 0 ${day} (Search Console through ${asOf}). Add --write to freeze.`);
  process.exit(0);
}
const { error } = await db
  .from("seo_baselines")
  .upsert(rows, { onConflict: "day,metric", ignoreDuplicates: true });
if (error) throw new Error(`seo_baselines write failed: ${error.message}`);
console.log(`\nFroze ${rows.length} metrics for Day 0 ${day} (existing values kept).`);
