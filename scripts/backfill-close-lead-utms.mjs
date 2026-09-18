#!/usr/bin/env node
/**
 * Backfill the lead-scoped UTM fields in Close from lead_submissions.
 *
 * Stephen's original utm_* fields are CONTACT-scoped, so until now a UTM only
 * ever reached the contact — invisible to Smart Views, Opportunities and every
 * report in Close, which are all lead-level. Once the five LEAD-scoped fields
 * exist and their IDs are in the env, new syncs write them; this fills in the
 * leads that were already synced.
 *
 * Latest touch wins, matching the live sync: the most recent submission per
 * Close lead is the one written. First-touch attribution is untouched — it
 * lives in Entry Source and Lead Cohort, which are written on create only.
 *
 * Writes to Close only. Never writes to Supabase, never touches a lead that has
 * no UTM to give it, and never sends a contact-scoped field ID on a lead update
 * (Close 400s the whole request if you do).
 *
 *   node scripts/backfill-close-lead-utms.mjs            # dry run, prints a plan
 *   node scripts/backfill-close-lead-utms.mjs --apply    # writes
 *   node scripts/backfill-close-lead-utms.mjs --apply --since 2026-08-01
 */

import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const sinceArg = process.argv.indexOf("--since");
const SINCE = sinceArg > -1 ? process.argv[sinceArg + 1] : "2026-01-01";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local is optional when the vars are already in the environment.
  }
  return env;
}

const env = loadEnv();

const FIELD_IDS = {
  utm_source: env.CLOSE_LEAD_UTM_SOURCE_FIELD_ID,
  utm_medium: env.CLOSE_LEAD_UTM_MEDIUM_FIELD_ID,
  utm_campaign: env.CLOSE_LEAD_UTM_CAMPAIGN_FIELD_ID,
  utm_term: env.CLOSE_LEAD_UTM_TERM_FIELD_ID,
  utm_content: env.CLOSE_LEAD_UTM_CONTENT_FIELD_ID,
};

const missing = Object.entries(FIELD_IDS)
  .filter(([, id]) => !id)
  .map(([key]) => key);
if (missing.length) {
  console.error(
    `Missing lead-scoped Close field IDs for: ${missing.join(", ")}.\n` +
      "Create them as LEAD custom fields in Close, then set " +
      "CLOSE_LEAD_UTM_{SOURCE,MEDIUM,CAMPAIGN,TERM,CONTENT}_FIELD_ID.",
  );
  process.exit(1);
}

const SUPABASE_URL = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const CLOSE_KEY = env.CLOSE_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !CLOSE_KEY) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and CLOSE_API_KEY.",
  );
  process.exit(1);
}

/** Every synced submission that carries a UTM, oldest first. */
async function loadSubmissions() {
  const columns =
    "created_at,close_lead_id,utm_source,utm_medium,utm_campaign,utm_term,utm_content";
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url =
      `${SUPABASE_URL}/rest/v1/lead_submissions?select=${columns}` +
      `&close_lead_id=not.is.null&utm_source=not.is.null` +
      `&created_at=gte.${SINCE}&order=created_at.asc` +
      `&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase read failed: ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/** Latest submission per Close lead — the rows arrive oldest first, so last wins. */
function latestPerLead(rows) {
  const byLead = new Map();
  for (const row of rows) byLead.set(row.close_lead_id, row);
  return byLead;
}

function leadPayload(row) {
  const payload = {};
  for (const [key, fieldId] of Object.entries(FIELD_IDS)) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") {
      payload[`custom.${fieldId}`] = value;
    }
  }
  return payload;
}

async function updateLead(leadId, payload) {
  const res = await fetch(`https://api.close.com/api/v1/lead/${leadId}/`, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLOSE_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

const rows = await loadSubmissions();
const targets = latestPerLead(rows);
console.log(
  `${rows.length} submissions with a UTM since ${SINCE} -> ${targets.size} distinct Close leads.`,
);

let written = 0;
let skipped = 0;
const failures = [];
for (const [leadId, row] of targets) {
  const payload = leadPayload(row);
  if (!Object.keys(payload).length) {
    skipped += 1;
    continue;
  }
  if (!APPLY) {
    if (written < 10) console.log(`  ${leadId}`, payload);
    written += 1;
    continue;
  }
  try {
    await updateLead(leadId, payload);
    written += 1;
    if (written % 50 === 0) console.log(`  ...${written} written`);
  } catch (error) {
    failures.push({ leadId, message: String(error.message ?? error) });
  }
}

console.log(
  APPLY
    ? `Done. ${written} leads updated, ${skipped} had nothing to write, ${failures.length} failed.`
    : `Dry run. ${written} leads would be updated, ${skipped} have nothing to write. Re-run with --apply.`,
);
for (const failure of failures.slice(0, 20)) {
  console.error(`  FAILED ${failure.leadId}: ${failure.message}`);
}
