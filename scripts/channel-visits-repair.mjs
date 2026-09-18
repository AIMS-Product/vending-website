#!/usr/bin/env node
/**
 * Re-pulls channel_daily.visits from GA4 one day at a time, clearing the
 * provisional link keys GA4 no longer reports.
 *
 * Same fault ga4-repair-superseded.mjs fixed on ga4_page_views: GA4 moves a
 * session between dimension keys for about two days after its day ends, the
 * old sync upserted the settled key and left the provisional one, so re-pulled
 * days counted the same sessions twice (August: 17,397 stored vs GA4 12,133).
 * The live sync now clears superseded keys, but only across its 3-day window.
 *
 * One day per GA4 report: a wider report folds rows into "(other)". Runs the
 * production sync step (syncGa4Visits) for that single day.
 *
 * Dry run by default. Before --apply, writes every stored visits row in the
 * range to a JSON snapshot so the repair is reversible.
 *
 * Usage: node scripts/channel-visits-repair.mjs --start 2026-02-01 --end 2026-09-18 [--apply]
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
const { createGa4Client } = await jiti.import(path.join(ROOT, "src/lib/ga4/client.ts"));
const { syncGa4Visits } = await jiti.import(path.join(ROOT, "src/lib/services/channel-sync.ts"));
const { createAdminClient } = await jiti.import(path.join(ROOT, "src/lib/supabase/admin.ts"));

const start = argValue("--start") ?? "2026-02-01";
const end = argValue("--end") ?? new Date().toISOString().slice(0, 10);
const apply = process.argv.includes("--apply");

const ga4 = createGa4Client({
  serviceAccountJson: process.env.GA4_SERVICE_ACCOUNT_JSON,
  propertyId: process.env.GA4_PROPERTY_ID,
});
const client = createAdminClient();

const days = [];
for (let day = new Date(`${start}T00:00:00Z`); day <= new Date(`${end}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
  days.push(day.toISOString().slice(0, 10));
}

if (apply) {
  const snapshot = [];
  for (const day of days) snapshot.push(...(await read(day)));
  const file = path.join(ROOT, `.claude/specs/channel-visits-snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot));
  console.log(`Snapshot of ${snapshot.length} stored visits rows: ${path.relative(ROOT, file)}\n`);
}

console.log(`${apply ? "APPLY" : "DRY RUN"}  ${start} -> ${end}  (${days.length} days)\n`);
console.log("day          stored ->    GA4   after");
const months = {};
for (const day of days) {
  const stored = sum(await read(day));
  const live = sum(await retry(() => ga4.fetchChannelSessions({ startDate: day, endDate: day })), "sessions");
  let after = "";
  if (apply) {
    // A thank-you write fails while its column is unapplied; visits still land,
    // so the day is read back either way and judged by its total.
    const result = await retry(() => syncGa4Visits(client, ga4, day, day, new Date()));
    if (result.error) console.log(`${day}  note: ${result.error}`);
    after = sum(await read(day));
  }
  const m = (months[day.slice(0, 7)] ??= { stored: 0, ga4: 0, after: 0 });
  m.stored += stored;
  m.ga4 += live;
  m.after += after || 0;
  console.log(`${day}  ${String(stored).padStart(6)} -> ${String(live).padStart(6)}  ${String(after).padStart(6)}`);
}

console.log("\nmonth     stored     GA4   " + (apply ? "after   after vs GA4" : "stored vs GA4"));
for (const [month, m] of Object.entries(months)) {
  const ref = apply ? m.after : m.stored;
  const pct = m.ga4 ? (((ref - m.ga4) / m.ga4) * 100).toFixed(1) : "n/a";
  console.log(`${month}  ${String(m.stored).padStart(7)} ${String(m.ga4).padStart(7)}  ${apply ? String(m.after).padStart(7) + "  " : ""}${pct}%`);
}

/** GA4 returns the odd transient 500; three tries with a pause. */
async function retry(fn) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= 3) throw error;
      console.log(`  retry ${attempt}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
    }
  }
}

async function read(day) {
  const response = await fetch(
    `${url}/rest/v1/channel_daily?select=day,source,medium,campaign,content,destination,visits&day=eq.${day}&visits=not.is.null`,
    { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-9999" } },
  );
  if (!response.ok) throw new Error(`read ${day}: ${response.status} ${await response.text()}`);
  return response.json();
}
function sum(list, field = "visits") {
  return Array.isArray(list) ? list.reduce((total, row) => total + (row[field] ?? 0), 0) : list;
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
