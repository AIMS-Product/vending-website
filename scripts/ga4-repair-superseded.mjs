#!/usr/bin/env node
/**
 * Re-pulls a date range one day at a time and removes the superseded rows the
 * old sync left behind.
 *
 * GA4 moves a session between dimension keys for about two days after its day
 * ends. The sync upserted the settled key and left the provisional one in
 * place, so a day re-pulled by the daily cron carried the same sessions under
 * two keys. Only days the cron re-pulled are affected: the one-shot historical
 * backfill wrote each key once, and Feb-Aug reconcile to GA4 within 1%.
 *
 * A day at a time, because a wider report crosses GA4's cardinality threshold,
 * GA4 folds rows into "(other)", and the client's own total check then refuses
 * the read. One day is also the smallest blast radius per delete.
 *
 * Dry run by default. Always writes the rows it would remove to a JSON file
 * first, so an --apply is reversible from that file plus GA4 itself.
 *
 * Usage: node scripts/ga4-repair-superseded.mjs --start 2026-09-01 --end 2026-09-17 [--apply]
 */

import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

const ROOT = process.cwd();
const env = readEnv(path.join(ROOT, ".env.local"));
for (const [name, value] of Object.entries(env)) process.env[name] ??= value;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(ROOT, "src"), "server-only": path.join(ROOT, "vitest.server-only-shim.ts") },
  interopDefault: true,
});
const { syncGa4PageViews } = await jiti.import(path.join(ROOT, "src/lib/services/ga4-page-view-sync.ts"));

const start = argValue("--start") ?? "2026-09-01";
const end = argValue("--end") ?? "2026-09-17";
const apply = process.argv.includes("--apply");

const days = [];
for (let day = new Date(`${start}T00:00:00Z`); day <= new Date(`${end}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
  days.push(day.toISOString().slice(0, 10));
}

const snapshotPath = path.join(
  ROOT,
  `.claude/specs/ga4-superseded-snapshot-${new Date().toISOString().slice(0, 10)}.json`,
);
const doomed = [];
let beforeSessions = 0;

console.log(`${apply ? "APPLY" : "DRY RUN"}  ${start} -> ${end}  (${days.length} days)\n`);
console.log("day          stored  ->  GA4    superseded  sessions removed");

for (const day of days) {
  const stored = await read(day);
  beforeSessions += sum(stored, (row) => row.sessions);

  if (!apply) {
    // A dry run cannot ask the sync what it would keep without writing, so it
    // asks GA4 the same question the sync asks and calls anything GA4 no
    // longer reports superseded. Same rule the purge uses.
    const live = await ga4Keys(day);
    const gone = stored.filter((row) => !live.has(keyOf(row)));
    doomed.push(...gone);
    console.log(
      `${day}  ${String(sum(stored, (r) => r.sessions)).padStart(6)}  -> ${String(live.size ? sumMap(live) : 0).padStart(5)}` +
        `  ${String(gone.length).padStart(10)}  ${String(sum(gone, (r) => r.sessions)).padStart(15)}`,
    );
    continue;
  }

  const result = await syncGa4PageViews({ startDate: day, endDate: day });
  if (result.failed > 0) {
    console.log(`${day}  FAILED ${result.failed} rows; purge skipped for this day.`);
    continue;
  }
  const after = await read(day);
  console.log(
    `${day}  ${String(sum(stored, (r) => r.sessions)).padStart(6)}  -> ${String(sum(after, (r) => r.sessions)).padStart(5)}` +
      `  ${String(result.purged).padStart(10)}  ${String(sum(stored, (r) => r.sessions) - sum(after, (r) => r.sessions)).padStart(15)}`,
  );
}

if (!apply) {
  fs.writeFileSync(snapshotPath, JSON.stringify(doomed, null, 2));
  console.log(
    `\n${doomed.length} superseded rows carrying ${sum(doomed, (r) => r.sessions)} sessions,` +
      ` out of ${beforeSessions} stored.`,
  );
  console.log(`Snapshot written to ${path.relative(ROOT, snapshotPath)}`);
  console.log("Re-run with --apply to remove them.");
}

function keyOf(row) {
  return [row.day, row.landing_page, row.utm_campaign, row.utm_source].join("\u0001");
}

async function read(day) {
  const response = await fetch(
    `${url}/rest/v1/ga4_page_views?select=day,landing_page,utm_campaign,utm_source,sessions,screen_page_views,synced_at&day=eq.${day}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-4999" } },
  );
  if (!response.ok) throw new Error(`read ${day}: ${response.status} ${await response.text()}`);
  return response.json();
}

/** GA4's current keys for one day, on the sync's own grain. */
async function ga4Keys(day) {
  const { createGa4Client } = await jiti.import(path.join(ROOT, "src/lib/ga4/client.ts"));
  const client = createGa4Client({
    serviceAccountJson: process.env.GA4_SERVICE_ACCOUNT_JSON,
    propertyId: process.env.GA4_PROPERTY_ID,
  });
  const rows = await client.fetchPageViews({ startDate: day, endDate: day });
  return new Map(
    rows.map((row) => [
      [row.day, row.landingPage, row.utmCampaign, row.utmSource].join("\u0001"),
      row.sessions,
    ]),
  );
}

function sumMap(map) {
  return [...map.values()].reduce((total, value) => total + value, 0);
}
function sum(list, pick) {
  return list.reduce((total, item) => total + (pick(item) ?? 0), 0);
}
function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => {
      const at = l.indexOf("=");
      return [l.slice(0, at).trim(), l.slice(at + 1).trim().replace(/^["']|["']$/g, "")];
    }),
  );
}
function argValue(flag) {
  const at = process.argv.indexOf(flag);
  return at === -1 ? null : process.argv[at + 1];
}
