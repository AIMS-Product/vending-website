/**
 * Read-only probe: does Close create Opportunity records for won deals?
 *
 * Open question 9 for Kody, and the one that decides C3 in
 * `.claude/specs/2026-09-10-youtube-attribution-review.md`: `earliestWonDate`
 * only trusts `status_type === "won"`, which returns nothing if this org
 * records wins purely as a lead status label. If that is the case, every
 * `closed_won_at` is `status_observed` and time-to-close cannot be backfilled.
 *
 * Reads only. Never writes to Close, never writes to Supabase.
 *
 * Usage: node scripts/probe-close-opportunities.mjs
 * Needs CLOSE_API_KEY (pull it with
 * `vercel env pull .env.production.local --environment=production`).
 */

import { readFileSync } from "node:fs";

function readEnvFile(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
        .map((line) => {
          const at = line.indexOf("=");
          return [
            line.slice(0, at).trim(),
            line
              .slice(at + 1)
              .trim()
              .replace(/^"|"$/g, ""),
          ];
        })
        // `vercel env pull` writes NAME="" for every value it will not
        // decrypt, and an empty string must not shadow a real one.
        .filter(([, value]) => value !== ""),
    );
  } catch {
    return {};
  }
}

const env = {
  ...readEnvFile(".env.local"),
  ...readEnvFile(".env.production.local"),
  ...process.env,
};

const closeKey = env.CLOSE_API_KEY;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!closeKey) throw new Error("CLOSE_API_KEY is not set");
if (!supabaseUrl || !serviceKey) throw new Error("Supabase env is not set");

const SAMPLE_SIZE = 12;

const leadsRes = await fetch(
  `${supabaseUrl}/rest/v1/lead_submissions` +
    `?select=id,close_lead_id,call_status` +
    `&close_lead_id=not.is.null&call_status=ilike.*Won*&limit=20`,
  { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
);
if (!leadsRes.ok) {
  throw new Error(`Supabase ${leadsRes.status}: ${await leadsRes.text()}`);
}
const leads = await leadsRes.json();

console.log(`won leads in our mirror: ${leads.length}`);
console.log("distinct labels:", [...new Set(leads.map((l) => l.call_status))]);

const auth = `Basic ${Buffer.from(`${closeKey}:`).toString("base64")}`;
const sample = leads.slice(0, SAMPLE_SIZE);
const shapes = [];
let withOpportunities = 0;
let wonStatusType = 0;
let withDateWon = 0;
let missingStatusType = 0;

for (const lead of sample) {
  const res = await fetch(
    `https://api.close.com/api/v1/lead/${encodeURIComponent(lead.close_lead_id)}/` +
      `?_fields=id,status_label,opportunities`,
    { headers: { Authorization: auth } },
  );
  if (!res.ok) {
    console.log(`  ${lead.close_lead_id}: HTTP ${res.status}`);
    continue;
  }
  const body = await res.json();
  const opportunities = Array.isArray(body.opportunities)
    ? body.opportunities
    : [];
  if (opportunities.length > 0) withOpportunities += 1;

  for (const opportunity of opportunities) {
    if (opportunity.status_type === "won") wonStatusType += 1;
    if (opportunity.date_won) withDateWon += 1;
    if (
      opportunity.status_type === undefined ||
      opportunity.status_type === null
    ) {
      missingStatusType += 1;
    }
    shapes.push({
      status_type: opportunity.status_type ?? null,
      status_label: opportunity.status_label ?? null,
      date_won: opportunity.date_won ?? null,
      date_created: opportunity.date_created
        ? String(opportunity.date_created).slice(0, 10)
        : null,
      has_value: opportunity.value !== undefined && opportunity.value !== null,
    });
  }
  console.log(
    `  ${body.status_label} -> ${opportunities.length} opportunities`,
  );
}

console.log(`\nleads sampled:                        ${sample.length}`);
console.log(`leads carrying >= 1 opportunity:      ${withOpportunities}`);
console.log(`opportunities with status_type "won": ${wonStatusType}`);
console.log(`opportunities carrying a date_won:    ${withDateWon}`);
console.log(`opportunities with NO status_type:    ${missingStatusType}`);
console.log("\nshapes:");
for (const shape of shapes) console.log("  ", JSON.stringify(shape));
