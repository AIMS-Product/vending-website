/**
 * Rebuild Dom's certified booked-calls V2 pull straight from Close, read-only,
 * with the same mapping and engine the dashboard uses, and compare.
 *
 *   npx tsx --env-file=.env.local scripts/booked-calls-v2-validate.ts [--out decisions.json]
 *
 * Needs CLOSE_API_KEY. Makes only GET/search reads (~300 requests). Exit 0 =
 * every certified figure matches, 2 = differences (printed), 1 = error.
 * Close is live, so small drift since Dom's read (2026-10-13 21:54:08Z) is
 * expected; each difference still needs a named reason before V2 is trusted.
 */
import { writeFileSync } from "node:fs";
import {
  LEAD_LABELS,
  mapLeadFacts,
  mapMeeting,
  monthWindows,
  wholeSecond,
  type LeadFieldIds,
  type MeetingRow,
} from "../src/lib/booked-calls-v2/close-mapping";
import {
  evaluate,
  summarize,
  type LeadFacts,
  type Meeting,
} from "../src/lib/booked-calls-v2/engine";

const FROM = "2026-10-01T07:00:00Z";
const FENCE = "2026-10-13T21:54:08Z";

/** Dom's memo §7, `booked_calls.v2.2`. */
const CERTIFIED = {
  candidates: 524,
  counted: 206,
  excluded: 280,
  held: 38,
  Marketing: 84,
  "Lane 2": 119,
  "Social DMs": 3,
  canceled: 104,
  follow_up_title: 56,
  unapproved_title: 64,
  repeat_within_60_days: 48,
  not_sales_call: 8,
  source_unavailable: 13,
  unlinked_reschedule: 21,
  ambiguous_simultaneous: 4,
  historicalExceptions: 12,
  unknownOrigin: 46,
  unknownOffer: 36,
} as const;

const key = process.env.CLOSE_API_KEY;
if (!key) {
  console.error("CLOSE_API_KEY is not set.");
  process.exit(1);
}
const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
let requests = 0;

async function close<T>(path: string, body?: unknown): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    requests += 1;
    const res = await fetch(`https://api.close.com/api/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 429 && attempt < 5) {
      const wait = Number(res.headers.get("retry-after")) || attempt;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Close ${path} -> ${res.status}`);
    return (await res.json()) as T;
  }
}

type Page = { data?: Array<Record<string, unknown>>; has_more?: boolean };

async function crawl(
  gte: string,
  lt: string,
  sink: (r: Record<string, unknown>) => void,
) {
  for (let skip = 0; ; skip += 100) {
    if (skip >= 2000) {
      const mid = wholeSecond(
        Date.parse(gte) + (Date.parse(lt) - Date.parse(gte)) / 2,
      );
      await crawl(gte, mid, sink);
      await crawl(mid, lt, sink);
      return;
    }
    const q = new URLSearchParams({
      date_created__gte: gte,
      date_created__lt: lt,
      _limit: "100",
      _skip: String(skip),
    });
    const page = await close<Page>(`/activity/meeting/?${q}`);
    for (const r of page.data ?? []) sink(r);
    if (!page.has_more) return;
  }
}

async function main() {
  const syncedAt = new Date().toISOString();
  const outcomes = new Map(
    (
      (
        await close<{ data?: Array<{ id: string; name?: string }> }>(
          "/outcome/?_limit=200",
        )
      ).data ?? []
    ).map((o) => [o.id, o.name ?? o.id]),
  );
  const rows = new Map<string, MeetingRow>();
  for (const [gte, lt] of monthWindows(new Date())) {
    await crawl(gte, lt, (raw) => {
      const row = mapMeeting(raw, outcomes, syncedAt);
      if (row) rows.set(row.id, row);
    });
  }
  console.log(`org meetings: ${rows.size} (Dom: 22,389 at his read)`);

  const meetings: Meeting[] = [...rows.values()].map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    userId: r.user_id ?? null,
    userName: r.user_name ?? null,
    title: r.title ?? null,
    status: r.status ?? null,
    outcome: r.outcome ?? null,
    startsAt: r.starts_at ?? null,
    dateCreated: r.date_created,
    rescheduleNote: Boolean(r.reschedule_note),
  }));
  const inWindow = (m: Meeting) =>
    m.dateCreated >= FROM && Date.parse(m.dateCreated) < Date.parse(FENCE);
  const leadIds = [...new Set(meetings.filter(inWindow).map((m) => m.leadId))];

  const byLabel = (defs: { data?: Array<{ id: string; name: string }> }) =>
    new Map((defs.data ?? []).map((d) => [d.name.trim().toLowerCase(), d.id]));
  const leadDefs = byLabel(await close("/custom_field/lead/?_limit=200"));
  const contactDefs = byLabel(await close("/custom_field/contact/?_limit=200"));
  const ids: LeadFieldIds = {
    lead: Object.fromEntries(
      Object.entries(LEAD_LABELS).map(([k, l]) => [k, leadDefs.get(l)]),
    ),
    utmSource: contactDefs.get("utm_source") ?? contactDefs.get("utm source"),
    utmMedium: contactDefs.get("utm_medium") ?? contactDefs.get("utm medium"),
  };
  console.log(
    "field ids resolved:",
    JSON.stringify({
      ...ids.lead,
      utmSource: ids.utmSource,
      utmMedium: ids.utmMedium,
    }),
  );

  const leads = new Map<string, LeadFacts>();
  const fields = Object.values(ids.lead)
    .filter(Boolean)
    .map((id) => `custom.${id}`);
  for (let i = 0; i < leadIds.length; i += 100) {
    const batch = leadIds.slice(i, i + 100);
    const res = await close<{ data?: Array<Record<string, unknown>> }>(
      "/data/search/",
      {
        query: {
          type: "or",
          queries: batch.map((id) => ({ type: "id", value: id })),
        },
        _fields: { lead: ["id", "contacts", ...fields] },
        _limit: 100,
      },
    );
    for (const lead of res.data ?? []) {
      const row = mapLeadFacts(lead, ids, syncedAt);
      if (!row) continue;
      leads.set(row.lead_id, {
        funnel: row.funnel ?? null,
        contactUtms:
          (row.contact_utms as Array<{ source?: string; medium?: string }>) ??
          [],
        resourceTag: row.resource_tag ?? null,
        setterName: row.setter_name ?? null,
        businessLine: row.business_line ?? null,
      });
    }
  }
  console.log(
    `candidate leads: ${leadIds.length} (Dom: 399), facts read: ${leads.size}`,
  );

  const decisions = evaluate({ meetings, leads, from: FROM, to: FENCE });
  const s = summarize(decisions);
  const ours: Record<string, number> = {
    candidates: s.candidates,
    counted: s.counted,
    excluded: s.excluded,
    held: s.held,
    ...s.byBookedBy,
    ...s.byReason,
    historicalExceptions: s.historicalExceptions,
    unknownOrigin: s.unknownOrigin,
    unknownOffer: s.unknownOffer,
  };
  let diffs = 0;
  for (const [name, expected] of Object.entries(CERTIFIED)) {
    const got = ours[name] ?? 0;
    if (got !== expected) diffs += 1;
    console.log(
      `${got === expected ? "  ok " : "DIFF "} ${name.padEnd(24)} ours ${String(got).padStart(4)}  Dom ${expected}`,
    );
  }
  console.log("origin x bucket:", JSON.stringify(s.byOrigin));
  console.log(`Close requests: ${requests}`);
  const out = process.argv.indexOf("--out");
  if (out > 0)
    writeFileSync(process.argv[out + 1]!, JSON.stringify(decisions, null, 1));
  process.exit(diffs === 0 ? 0 : 2);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
