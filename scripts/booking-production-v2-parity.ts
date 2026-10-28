/** Read-only parity check against a frozen canonical Python booking fixture.
 * Raw Close fixtures stay outside source control. Prints counts only.
 * Usage: node --import tsx scripts/booking-production-v2-parity.ts <private-fixture.json>
 */
import { readFileSync } from "node:fs";
import {
  evaluate,
  type LeadFacts,
  type Meeting,
} from "../src/lib/booked-calls-v2/engine";
import rules from "../src/lib/booked-calls-v2/rules.v2.6-any-meeting-clock.json";
type Raw = Record<string, unknown>;
type Fixture = {
  from: string;
  to: string;
  leads: Record<
    string,
    {
      funnel: string | null;
      setter_name: string | null;
      business_line: string | null;
    }
  >;
  contacts: Record<string, Raw[]>;
  outcomes: Record<string, string>;
  meetings: Array<{
    id: string;
    lead_id: string;
    user_id?: string | null;
    title?: string | null;
    status?: string | null;
    outcome_id?: string | null;
    starts_at?: string | null;
    date_created: string;
  }>;
  expected: Array<{ meeting_id: string; bucket: string; channel: string }>;
};
const fixture = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as Fixture;
const custom = (r: Raw, id: string) => {
  const nested =
    r.custom && typeof r.custom === "object" ? (r.custom as Raw) : {};
  let v = r[`custom.${id}`] ?? nested[id];
  if (Array.isArray(v)) v = v[0];
  if (v && typeof v === "object") v = (v as Raw).name || (v as Raw).label;
  return v == null ? null : String(v).trim() || null;
};
const leads = new Map<string, LeadFacts>(
  Object.entries(fixture.leads).map(([id, raw]) => {
    const l = raw;
    return [
      id,
      {
        funnel: l.funnel,
        setterName: l.setter_name,
        businessLine: l.business_line,
        contactUtms: (fixture.contacts[id] ?? []).map((c: Raw) => ({
          source: custom(c, rules.contact_utm_fields.source),
        })),
      },
    ];
  }),
);
const meetings: Meeting[] = fixture.meetings.map((r) => ({
  id: r.id,
  leadId: r.lead_id,
  userId: r.user_id ?? null,
  userName: null,
  title: r.title ?? null,
  status: r.status ?? null,
  outcome: fixture.outcomes[r.outcome_id ?? ""] ?? null,
  startsAt: r.starts_at ?? null,
  dateCreated: r.date_created,
}));
const decisions = evaluate({
  meetings,
  leads,
  from: fixture.from,
  to: fixture.to,
});
const actual = decisions
  .filter((d) => d.disposition === "counted")
  .map((d) =>
    [d.meetingId, d.bookedBy, d.origin.source ?? "Unknown (Needs Review)"].join(
      "|",
    ),
  )
  .sort();
const expected = fixture.expected
  .map((r: Record<string, string>) =>
    [r.meeting_id, r.bucket, r.channel].join("|"),
  )
  .sort();
const a = new Set(actual),
  e = new Set(expected);
const missing = expected.filter((x: string) => !a.has(x)),
  extra = actual.filter((x) => !e.has(x));
console.log(
  JSON.stringify({
    canonicalCredits: expected.length,
    serviceCredits: actual.length,
    missing: missing.length,
    extra: extra.length,
    exactParity: JSON.stringify(actual) === JSON.stringify(expected),
  }),
);
if (missing.length || extra.length) process.exitCode = 1;
