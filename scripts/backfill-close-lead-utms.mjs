#!/usr/bin/env node
/**
 * Backfill the lead-scoped UTM fields in Close by copying each lead's own
 * contact.
 *
 * Stephen's original utm_* fields are CONTACT-scoped, so a UTM only ever
 * reached the contact — invisible to Smart Views, Opportunities and every
 * report in Close, which are all lead-level. Once the five LEAD-scoped fields
 * exist and their IDs are in the env, new syncs write them; this fills in the
 * leads that were already synced.
 *
 * The contact is the source, not our own lead_submissions table, because the
 * contact fields hold every writer's values and ours hold only our own: the
 * `april7` and `feb3` webinar tags that four live Smart Views filter on appear
 * in zero of our rows, because they predate the site cutover on 2026-07-27.
 * Reading the contact covers every era and every writer.
 *
 * Latest touch, matching the live sync: the contact fields are overwritten on
 * each sync, so they already hold the latest touch. Where a lead has several
 * contacts carrying UTMs, the most recently updated one wins. First-touch
 * attribution is untouched — it lives in Entry Source and Lead Cohort, which
 * are lead-scoped and written on create only.
 *
 * Writes to Close only. Never writes to Supabase, never touches a lead whose
 * contacts carry no UTM, and never sends a contact-scoped field ID on a lead
 * update (Close 400s the whole request if you do).
 *
 *   node scripts/backfill-close-lead-utms.mjs            # dry run, prints a plan
 *   node scripts/backfill-close-lead-utms.mjs --apply    # writes
 *   node scripts/backfill-close-lead-utms.mjs --apply --limit 50
 */

import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
// Contact tagging only starts in 2026; --from keeps a re-run from re-walking
// years of empty months, and makes a long run resumable.
const FROM = arg("--from", "2026-01-01");
const TO = arg("--to", null);

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

/** The contact fields we read from — Stephen's originals. */
const CONTACT_FIELD_IDS = {
  utm_source: env.CLOSE_UTM_SOURCE_FIELD_ID,
  utm_medium: env.CLOSE_UTM_MEDIUM_FIELD_ID,
  utm_campaign: env.CLOSE_UTM_CAMPAIGN_FIELD_ID,
  utm_term: env.CLOSE_UTM_TERM_FIELD_ID,
  utm_content: env.CLOSE_UTM_CONTENT_FIELD_ID,
};

/** The lead fields we write to — the new set. */
const LEAD_FIELD_IDS = {
  utm_source: env.CLOSE_LEAD_UTM_SOURCE_FIELD_ID,
  utm_medium: env.CLOSE_LEAD_UTM_MEDIUM_FIELD_ID,
  utm_campaign: env.CLOSE_LEAD_UTM_CAMPAIGN_FIELD_ID,
  utm_term: env.CLOSE_LEAD_UTM_TERM_FIELD_ID,
  utm_content: env.CLOSE_LEAD_UTM_CONTENT_FIELD_ID,
};

function requireIds(ids, label, hint) {
  const missing = Object.entries(ids)
    .filter(([, id]) => !id)
    .map(([key]) => key);
  if (missing.length) {
    console.error(`Missing ${label} Close field IDs for: ${missing.join(", ")}.\n${hint}`);
    process.exit(1);
  }
}

requireIds(
  CONTACT_FIELD_IDS,
  "contact-scoped",
  "These already exist in Close. Set CLOSE_UTM_{SOURCE,MEDIUM,CAMPAIGN,TERM,CONTENT}_FIELD_ID.",
);
requireIds(
  LEAD_FIELD_IDS,
  "lead-scoped",
  "Create them as LEAD custom fields in Close, then set " +
    "CLOSE_LEAD_UTM_{SOURCE,MEDIUM,CAMPAIGN,TERM,CONTENT}_FIELD_ID.",
);

const CLOSE_KEY = env.CLOSE_API_KEY;
if (!CLOSE_KEY) {
  console.error("Need CLOSE_API_KEY.");
  process.exit(1);
}

const AUTH = `Basic ${Buffer.from(`${CLOSE_KEY}:`).toString("base64")}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Close rate-limits hard enough that a full pass hits it: reading the tagged
 * contacts alone is thousands of requests. A 429 carries `rate_reset` seconds
 * in its body, so wait that long and retry rather than losing the run.
 */
async function close(method, path, body, attempt = 0) {
  const res = await fetch(`https://api.close.com/api/v1${path}`, {
    method,
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 429 && attempt < 8) {
    const text = await res.text();
    let wait = 2 ** attempt;
    try {
      wait = Number(JSON.parse(text)?.error?.rate_reset ?? wait) || wait;
    } catch {
      // A 429 without a JSON body still deserves a backoff.
    }
    await sleep(Math.min(Math.ceil(wait * 1000) + 250, 30_000));
    return close(method, path, body, attempt + 1);
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

/** The `_fields` a search must ask for — results carry only ids otherwise. */
const CONTACT_FIELDS = [
  "id",
  "lead_id",
  "date_updated",
  "date_created",
  ...Object.values(CONTACT_FIELD_IDS).map((id) => `custom.${id}`),
];

function taggedContactQuery(from, to) {
  return {
    type: "and",
    negate: false,
    queries: [
      { type: "object_type", object_type: "contact", negate: false },
      {
        type: "and",
        negate: false,
        queries: [
          {
            type: "field_condition",
            negate: false,
            field: {
              type: "custom_field",
              custom_field_id: CONTACT_FIELD_IDS.utm_source,
            },
            condition: { type: "exists" },
          },
          {
            type: "field_condition",
            negate: false,
            field: {
              type: "regular_field",
              object_type: "contact",
              field_name: "date_created",
            },
            condition: {
              type: "moment_range",
              on_or_after: { type: "fixed_local_date", value: from, which: "start" },
              before: { type: "fixed_local_date", value: to, which: "start" },
            },
          },
        ],
      },
    ],
  };
}

/** Close refuses to page past this, hence the date windows below. */
const SKIP_CAP = 10_000;

async function pageWindow(from, to) {
  const rows = [];
  let cursor = null;
  for (;;) {
    const body = {
      query: taggedContactQuery(from, to),
      _limit: 200,
      _fields: { contact: CONTACT_FIELDS },
      ...(cursor ? { cursor } : {}),
    };
    const page = await close("POST", "/data/search/", body);
    rows.push(...(page.data ?? []));
    cursor = page.cursor;
    if (!cursor) return rows;
    if (rows.length >= SKIP_CAP) return null; // too big — caller splits it
  }
}

function midpoint(from, to) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  const mid = new Date(a + Math.floor((b - a) / 2));
  return mid.toISOString().slice(0, 10);
}

/**
 * Every contact carrying a utm_source, with its lead.
 *
 * Close's REST list endpoints cannot filter on a custom field, so this uses the
 * search API — which refuses to page past 10,000 results. There are more tagged
 * contacts than that, so the range is walked in windows on date_created, and a
 * window that still overflows is split in half until it fits.
 */
async function loadTaggedContacts() {
  const contacts = [];
  const today = new Date();
  const end =
    TO ??
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10);
  const windows = [];
  const start = new Date(`${FROM}T00:00:00Z`);
  for (
    let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    cur.toISOString().slice(0, 10) < end;
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))
  ) {
    const from = cur.toISOString().slice(0, 10);
    const to = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10);
    windows.push([from, to < end ? to : end]);
  }

  const pending = [...windows];
  while (pending.length) {
    const [from, to] = pending.shift();
    const rows = await pageWindow(from, to);
    if (rows === null) {
      const mid = midpoint(from, to);
      if (mid === from || mid === to) {
        console.warn(`  window ${from}..${to} cannot be split further; some rows skipped`);
        continue;
      }
      pending.unshift([mid, to]);
      pending.unshift([from, mid]);
      continue;
    }
    contacts.push(...rows);
    process.stdout.write(`\r  ${from} -> ${contacts.length} tagged contacts   `);
  }
  process.stdout.write("\n");
  return contacts;
}

function utmsFrom(contact) {
  const values = {};
  for (const [key, fieldId] of Object.entries(CONTACT_FIELD_IDS)) {
    const value = contact[`custom.${fieldId}`];
    if (value !== null && value !== undefined && value !== "") values[key] = value;
  }
  return values;
}

function leadPayload(values) {
  const payload = {};
  for (const [key, value] of Object.entries(values)) {
    payload[`custom.${LEAD_FIELD_IDS[key]}`] = value;
  }
  return payload;
}

const contacts = await loadTaggedContacts();

/** Latest touch per lead: the most recently updated contact that carries UTMs. */
const byLead = new Map();
for (const contact of contacts) {
  const leadId = contact.lead_id;
  if (!leadId) continue;
  const values = utmsFrom(contact);
  if (!Object.keys(values).length) continue;
  const updated = contact.date_updated ?? contact.date_created ?? "";
  const existing = byLead.get(leadId);
  if (!existing || updated > existing.updated) byLead.set(leadId, { values, updated });
}

console.log(`${contacts.length} tagged contacts -> ${byLead.size} distinct Close leads.`);

let written = 0;
let shown = 0;
const failures = [];
for (const [leadId, { values }] of byLead) {
  if (written >= LIMIT) break;
  const payload = leadPayload(values);
  if (!APPLY) {
    if (shown++ < 10) console.log(`  ${leadId}`, values);
    written += 1;
    continue;
  }
  try {
    await close("PUT", `/lead/${leadId}/`, payload);
    written += 1;
    if (written % 100 === 0) console.log(`  ...${written} written`);
  } catch (error) {
    failures.push({ leadId, message: String(error.message ?? error) });
  }
}

console.log(
  APPLY
    ? `Done. ${written} leads updated, ${failures.length} failed.`
    : `Dry run. ${written} leads would be updated. Re-run with --apply.`,
);
for (const failure of failures.slice(0, 20)) {
  console.error(`  FAILED ${failure.leadId}: ${failure.message}`);
}
