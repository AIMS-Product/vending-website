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
const fixture = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const custom = (r: Record<string, any>, id: string) => {
  let v = r[`custom.${id}`] ?? r.custom?.[id];
  if (Array.isArray(v)) v = v[0];
  if (v && typeof v === "object") v = v.name || v.label;
  return v == null ? null : String(v).trim() || null;
};
const leads = new Map<string, LeadFacts>(
  Object.entries(fixture.leads).map(([id, raw]) => {
    const l = raw as Record<string, any>;
    return [
      id,
      {
        funnel: l.funnel,
        setterName: l.setter_name,
        businessLine: l.business_line,
        contactUtms: (fixture.contacts[id] ?? []).map(
          (c: Record<string, any>) => ({
            source: custom(c, rules.contact_utm_fields.source),
          }),
        ),
      },
    ];
  }),
);
const meetings: Meeting[] = fixture.meetings.map((r: Record<string, any>) => ({
  id: r.id,
  leadId: r.lead_id,
  userId: r.user_id ?? null,
  userName: null,
  title: r.title ?? null,
  status: r.status ?? null,
  outcome: fixture.outcomes[r.outcome_id] ?? null,
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
