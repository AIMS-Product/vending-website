/**
 * ManyChat backfill. Dry run by default; `--apply` writes manychat_contacts
 * and manychat_lead_matches (migration 20261008121000) after the report.
 *
 * Joins Close leads to ManyChat contacts on evidence (scripts/lib/manychat-match.mjs):
 * a match is confirmed only when two independent signals agree. Candidates come
 * from two lookups per lead:
 *
 *   1. link  the ManyChat id a setter's link put in utm_campaign, on the lead's
 *            Calendly booking or site form fill, read with fb/subscriber/getInfo
 *   2. name  fb/subscriber/findByName on the Close display name (Instagram
 *            funnel leads only; ManyChat cannot list contacts)
 *
 * Accuracy check: every lead whose booking link carried a personal ManyChat id
 * is matched AGAIN with the link hidden, and the pick is compared with the id.
 * That is the error rate of every match that has no link to lean on.
 *
 * Raw responses: tmp/manychat-backfill/*.jsonl (git-ignored, PII). Re-runs read
 * them instead of asking again. Results: tmp/manychat-backfill/matches.json.
 *
 *   node scripts/manychat-backfill.mjs           # dry run: report only
 *   node scripts/manychat-backfill.mjs --apply   # report, then write
 */
import fs from "node:fs";
import { personalLinkIds, pickMatch, scoreCandidate } from "./lib/manychat-match.mjs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const ACCOUNTS = { mike: env.MANYCHAT_API_KEY_MIKE, anthony: env.MANYCHAT_API_KEY_ANTHONY };
const IG_FUNNELS = new Set(["Instagram", "Anthony IG"]);
const OUT = "tmp/manychat-backfill";
const APPLY = process.argv.includes("--apply");
// Bump when scripts/lib/manychat-match.mjs changes what counts as confirmed.
const RULES_VERSION = 1;

for (const [account, key] of Object.entries(ACCOUNTS)) {
  if (!key) throw new Error(`ManyChat key for ${account} missing from .env.local`);
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase URL or service-role key missing from .env.local");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parseBody = (text) => JSON.parse(text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ""));

/** Paged PostgREST read; `order=` keeps pages stable. */
async function readAll(table, query) {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?${query}&limit=1000&offset=${offset}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${table} read ${response.status}: ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

// --- raw-response cache, one jsonl per account per endpoint -----------------
fs.mkdirSync(OUT, { recursive: true });
function loadCache(file) {
  const path = `${OUT}/${file}`;
  if (!fs.existsSync(path)) return new Map();
  return new Map(
    fs.readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => {
      const { name, body } = JSON.parse(line);
      return [name, body];
    }),
  );
}
const cache = {};
for (const account of Object.keys(ACCOUNTS)) {
  cache[`${account}.jsonl`] = loadCache(`${account}.jsonl`); // findByName, keyed by name
  cache[`${account}-getinfo.jsonl`] = loadCache(`${account}-getinfo.jsonl`); // keyed by id
}
const throttled = { count: 0 };

/** One ManyChat GET, cached. Throws on auth/other errors so a dead key never reads as "no match". */
async function manychat(account, file, cacheKey, path) {
  const hit = cache[file].get(cacheKey);
  if (hit !== undefined) return hit === "" ? null : parseBody(hit);
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(`https://api.manychat.com/fb/${path}`, {
      headers: { authorization: `Bearer ${ACCOUNTS[account]}` },
    });
    const text = await response.text();
    if (response.status === 429 || response.status >= 500) {
      throttled.count++;
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    // getInfo on an id from another page (or a deleted contact) answers 400.
    const missing = response.status === 400 && /subscriber/i.test(text);
    if (!response.ok && !missing) throw new Error(`${account} ${path.split("?")[0]} answered ${response.status}: ${text.slice(0, 200)}`);
    const stored = missing ? "" : text;
    cache[file].set(cacheKey, stored);
    fs.appendFileSync(`${OUT}/${file}`, `${JSON.stringify({ name: cacheKey, body: stored })}\n`);
    if (missing) return null;
    const json = parseBody(text);
    if (json.status !== "success") throw new Error(`${account} ${path.split("?")[0]} status ${json.status}`);
    return json;
  }
  throw new Error(`${account} ${path.split("?")[0]} kept failing`);
}

const findByName = async (account, name) =>
  (await manychat(account, `${account}.jsonl`, name, `subscriber/findByName?name=${encodeURIComponent(name)}`))?.data ?? [];

/** The contact behind a link id, from whichever page owns it. */
async function getInfo(id) {
  for (const account of Object.keys(ACCOUNTS)) {
    const json = await manychat(account, `${account}-getinfo.jsonl`, id, `subscriber/getInfo?subscriber_id=${id}`);
    if (json?.data) return { account, contact: json.data };
  }
  return null;
}

// --- population ---------------------------------------------------------------
const leads = await readAll(
  "close_lead_funnel",
  "select=lead_id,display_name,email,funnel,first_sales_call_booked_date,status_label&order=lead_id",
);
const bookings = await readAll(
  "calendly_bookings",
  "select=invitee_email,utm_source,utm_campaign&utm_campaign=not.is.null&invitee_email=not.is.null&order=id",
);
const formFills = await readAll(
  "lead_submissions",
  "select=email,utm_source,utm_campaign&utm_campaign=not.is.null&order=id",
);
// Same person on both a booking and a form counts once; personalLinkIds keys by email.
const linkIdsByEmail = personalLinkIds([
  ...bookings,
  ...formFills.map((f) => ({ invitee_email: f.email, utm_source: f.utm_source, utm_campaign: f.utm_campaign })),
]);
const population = leads.filter(
  (l) => IG_FUNNELS.has(l.funnel) || linkIdsByEmail.has(String(l.email ?? "").toLowerCase()),
);
const linkIds = new Set([...linkIdsByEmail.values()].flatMap((s) => [...s]));
console.log(
  `population: ${population.length} Close leads (${population.filter((l) => IG_FUNNELS.has(l.funnel)).length} on an Instagram funnel); ` +
    `${linkIds.size} ManyChat ids in DM booking links across ${linkIdsByEmail.size} emails`,
);

// --- lookups --------------------------------------------------------------------
const contactById = new Map(); // id -> { account, contact }
let done = 0;
for (const id of linkIds) {
  const found = await getInfo(id);
  if (found) contactById.set(String(found.contact.id), found);
  if (++done % 50 === 0) console.log(`  link ids ${done}/${linkIds.size} (retries ${throttled.count})`);
}

const results = [];
const pickedContacts = new Map(); // "account:id" -> { account, contact }
const answerKey = { leads: 0, right: 0, wrong: 0, left_out: 0 };
for (const [i, lead] of population.entries()) {
  const email = String(lead.email ?? "").toLowerCase();
  const leadLinkIds = linkIdsByEmail.get(email) ?? new Set();
  const candidates = []; // { account, contact, via }
  for (const id of leadLinkIds) {
    const found = contactById.get(id);
    if (found) candidates.push({ ...found, via: "link" });
  }
  const name = lead.display_name?.trim();
  if (name && IG_FUNNELS.has(lead.funnel)) {
    for (const account of Object.keys(ACCOUNTS)) {
      for (const contact of await findByName(account, name)) candidates.push({ account, contact, via: "name" });
    }
  }
  const ctx = { linkedIds: leadLinkIds, bookedOn: lead.first_sales_call_booked_date };
  const scored = candidates.map((c) => ({ ...scoreCandidate(lead, c.contact, ctx), account: c.account, via: c.via }));
  const pick = pickMatch(scored);

  // Answer key: hide the link and see whether the name search alone picks the linked contact.
  const linked = candidates.filter((c) => c.via === "link");
  if (linked.length === 1 && candidates.some((c) => c.via === "name")) {
    const blind = { linkedIds: new Set(), bookedOn: lead.first_sales_call_booked_date };
    const blindPick = pickMatch(
      candidates.filter((c) => c.via === "name").map((c) => scoreCandidate(lead, c.contact, blind)),
    );
    answerKey.leads++;
    if (blindPick.level !== "confirmed") answerKey.left_out++;
    else if (blindPick.match.id === String(linked[0].contact.id)) answerKey.right++;
    else answerKey.wrong++;
  }

  const contact = pick.match ? candidates.find((c) => String(c.contact.id) === pick.match.id) : null;
  if (contact) pickedContacts.set(`${contact.account}:${contact.contact.id}`, contact);
  results.push({
    lead_id: lead.lead_id,
    funnel: lead.funnel,
    booked_on: lead.first_sales_call_booked_date,
    level: pick.level,
    account: pick.match?.account ?? null,
    subscriber_id: pick.match?.id ?? null,
    signals: pick.match?.signals ?? [],
    optin_keyword: contact?.contact.custom_fields?.find((f) => f.name === "OptinKeyword")?.value ?? null,
    candidates: pick.candidates.map(({ id, signals, level, active, account, via }) => ({ id, signals, level, active, account, via })),
  });
  if ((i + 1) % 200 === 0) console.log(`  leads ${i + 1}/${population.length} (retries ${throttled.count})`);
}
fs.writeFileSync(`${OUT}/matches.json`, JSON.stringify(results, null, 1));

// --- report -----------------------------------------------------------------------
const count = (rows, key) =>
  Object.entries(rows.reduce((m, r) => ((m[key(r)] = (m[key(r)] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const ig = results.filter((r) => IG_FUNNELS.has(r.funnel));
const other = results.filter((r) => !IG_FUNNELS.has(r.funnel));
const pct = (n, d) => `${((100 * n) / Math.max(d, 1)).toFixed(1)}%`;
const show = (label, rows) => {
  const levels = Object.fromEntries(count(rows, (r) => r.level));
  console.log(`\n== ${label}: ${rows.length} leads`);
  console.log(`   confirmed ${levels.confirmed ?? 0} (${pct(levels.confirmed ?? 0, rows.length)}) · single-signal ${levels.single ?? 0} · ambiguous ${levels.ambiguous ?? 0} · conflict ${levels.conflict ?? 0} · subscribed-after ${levels.after ?? 0} · none ${levels.none ?? 0}`);
  const confirmed = rows.filter((r) => r.level === "confirmed");
  console.log(`   confirmed by account: ${JSON.stringify(count(confirmed, (r) => r.account))}`);
  console.log(`   confirmed by evidence: ${JSON.stringify(count(confirmed, (r) => r.signals.join("+")))}`);
  console.log(`   single-signal by evidence: ${JSON.stringify(count(rows.filter((r) => r.level === "single"), (r) => r.signals.join("+")))}`);
};
show("Close Instagram funnel", ig);
show("Close credits another funnel, but booked through a DM link", other);
if (other.length) console.log(`   their Close funnels: ${JSON.stringify(count(other, (r) => r.funnel).slice(0, 10))}`);
console.log(
  `\naccuracy check (link hidden, ${answerKey.leads} leads): confirmed the right contact ${answerKey.right}, ` +
    `a WRONG contact ${answerKey.wrong}, left unconfirmed ${answerKey.left_out}`,
);
console.log(`link ids that resolved to a contact: ${contactById.size}/${linkIds.size}`);
console.log(`OptinKeyword on confirmed: ${JSON.stringify(count(results.filter((r) => r.level === "confirmed"), (r) => String(r.optin_keyword ?? "(none)").toUpperCase()).slice(0, 15))}`);
console.log(`retries (429/5xx): ${throttled.count}`);

if (!APPLY) {
  console.log("\ndry run: nothing written. Re-run with --apply to write.");
  process.exit(0);
}

// --- write -------------------------------------------------------------------
/** Upsert in chunks; PostgREST merges on the primary key. */
async function upsert(table, rows) {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates,return=minimal",
  };
  for (let i = 0; i < rows.length; i += 500) {
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers,
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!response.ok) throw new Error(`${table} upsert ${response.status}: ${await response.text()}`);
  }
}

const field = (contact, name) => contact.custom_fields?.find((f) => f.name === name)?.value ?? null;
const contactRows = [...pickedContacts.values()].map(({ account, contact }) => ({
  account,
  subscriber_id: String(contact.id),
  ig_username: contact.ig_username ?? null,
  name: contact.name ?? null,
  subscribed_at: contact.subscribed ?? null,
  last_interaction_at: contact.ig_last_interaction || contact.last_interaction || null,
  optin_keyword: field(contact, "OptinKeyword"),
  tags: (contact.tags ?? []).map((t) => t.name).filter(Boolean),
  custom_fields: contact.custom_fields ?? [],
  fetched_at: new Date().toISOString(),
}));
const matchRows = results
  .filter((r) => r.level !== "none")
  .map((r) => ({
    close_lead_id: r.lead_id,
    level: r.level,
    account: r.subscriber_id ? r.account : null,
    subscriber_id: r.subscriber_id,
    signals: r.signals,
    candidates: r.candidates,
    rules_version: RULES_VERSION,
    matched_at: new Date().toISOString(),
  }));
await upsert("manychat_contacts", contactRows);
await upsert("manychat_lead_matches", matchRows);

// A lead that matched on an earlier run but has no evidence now must not keep its old row.
const cleared = results.filter((r) => r.level === "none").map((r) => r.lead_id);
for (let i = 0; i < cleared.length; i += 100) {
  const ids = cleared.slice(i, i + 100).map((id) => `"${id}"`).join(",");
  const response = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/manychat_lead_matches?close_lead_id=in.(${encodeURIComponent(ids)})`,
    {
      method: "DELETE",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        prefer: "return=minimal",
      },
    },
  );
  if (!response.ok) throw new Error(`manychat_lead_matches delete ${response.status}: ${await response.text()}`);
}
console.log(
  `\nwrote ${contactRows.length} manychat_contacts and ${matchRows.length} manychat_lead_matches rows; ` +
    `cleared any old match for ${cleared.length} leads with no evidence now`,
);
