import { describe, expect, it } from "vitest";
import {
  evaluate,
  pacificDayGap,
  summarize,
  type LeadFacts,
  type Meeting,
} from "@/lib/booked-calls-v2/engine";
import { TITLE_MAP } from "@/lib/booked-calls-v2/rules";
import { resolveOrigin } from "@/lib/booked-calls-v2/sources";

const FROM = "2026-10-01T07:00:00Z";
const TO = "2026-10-14T07:00:00Z";

let seq = 0;
function meeting(over: Partial<Meeting> = {}): Meeting {
  seq += 1;
  return {
    id: `acti_${String(seq).padStart(4, "0")}`,
    leadId: "lead_a",
    userId: "user_closer",
    userName: "Closer",
    title: "Vending Strategy Call",
    status: "upcoming",
    outcome: null,
    startsAt: "2026-10-08T18:00:00Z",
    dateCreated: "2026-10-05T18:00:00Z",
    rescheduleNote: false,
    ...over,
  };
}

const youtube: LeadFacts = {
  funnel: "YouTube",
  contactUtms: [],
  resourceTag: null,
  setterName: null,
  businessLine: "Vendingpreneurs (VP)",
};

function decide(meetings: Meeting[], lead: LeadFacts | null = youtube) {
  const leads = new Map<string, LeadFacts>();
  if (lead) leads.set("lead_a", lead);
  return evaluate({ meetings, leads, from: FROM, to: TO });
}

describe("title map", () => {
  const cases: Array<[string, string, string]> = [
    ["PPA Growth - Next Steps", "Tony Parton", "Lane 2"],
    ["Vendingpreneurs Enterprise - Next Steps", "Ashley Atencio", "Lane 2"],
    ["Vendingpreneurs Velocity - Next Steps", "Ibraheem Khan", "Lane 2"],
    ["Vendingpreneurs Pinnacle - Next Steps", "Monde", "Lane 2"],
    ["Vendingpreneurs Executive - Next Steps", "Finley Eastlake", "Lane 2"],
    ["Vendingpreneurs - Next Steps Call", "Charlie Ingram", "Lane 2"],
    ["Vendingpreneurs Next Steps Call", "Vince Bartolini", "Lane 2"],
    ["Vendingpreneur Next Steps", "William Nowak", "Lane 2"],
    ["Vendingpreneurs Next Steps Session", "Pearl Sathekge", "Social DMs"],
    ["Vending Discovery Call - Next Steps", "August Young", "Lane 2"],
    ["Vending Opportunity - Next Steps", "Cassie Caraballo", "Lane 2"],
    ["Vendingpreneurs Connect - Next Steps", "Jessica Zatkin", "Lane 2"],
    ["Vendingpreneurs Momentum - Next Steps", "Connor George", "Lane 2"],
    ["Vendingpreneurs Pathway - Next Steps", "Naria Torres", "Lane 2"],
    ["Vendingpreneurs Blueprint - Next Steps", "Melia King", "Lane 2"],
    ["TLG Pinnacle - Next Steps", "Kaylane Nunes", "Lane 2"],
    ["TLG Compass - Next Steps", "Josh Stoffel", "Lane 2"],
    ["TLG Elevate - Next Steps", "Catalina", "Lane 2"],
    ["TLG Vanguard - Next Steps", "Connor Mason", "Lane 2"],
    ["TLG Northstar - Next Steps", "Jonathan Quinn", "Lane 2"],
    ["Vendingpreneurs Ascent - Next Steps", "Owen Hart", "Lane 2"],
    ["Vendingpreneurs Keystone - Next Steps", "Brad Savage", "Lane 2"],
    ["Vendingpreneurs Summit - Next Steps", "Rob Maxfield", "Lane 2"],
    ["Vendingpreneurs Growth - Next Steps", "Igor Trojanowski", "Lane 2"],
    ["Vendingpreneurs Horizon - Next Steps", "Ariella Irvine", "Lane 2"],
  ];

  it("has exactly the 25 approved entries", () => {
    expect(TITLE_MAP).toHaveLength(25);
  });

  it.each(cases)("%s -> %s (%s)", (title, setter, bucket) => {
    const [d] = decide([meeting({ title })]);
    expect(d).toMatchObject({
      disposition: "counted",
      mappedSetter: setter,
      bookedBy: bucket,
    });
  });

  it("tolerates case, spacing and the -preneur misspelling", () => {
    const [d] = decide([
      meeting({ title: "vendingpreneuers   CONNECT next steps" }),
    ]);
    expect(d.mappedSetter).toBe("Jessica Zatkin");
  });

  it("does not credit the retired TLG Clarity title", () => {
    const [d] = decide([meeting({ title: "TLG Clarity - Next Steps" })]);
    expect(d).toMatchObject({
      disposition: "excluded",
      reason: "follow_up_title",
    });
  });

  it("counts a mapped title with no origin as Lane 2, source unknown", () => {
    const [d] = decide([meeting({ title: "Vendingpreneur Next Steps" })], null);
    expect(d).toMatchObject({ disposition: "counted", bookedBy: "Lane 2" });
    expect(d.origin.source).toBeNull();
  });
});

describe("marketing credit", () => {
  it("counts an approved family with a supported origin", () => {
    const [d] = decide([meeting()]);
    expect(d).toMatchObject({ disposition: "counted", bookedBy: "Marketing" });
    expect(d.origin).toEqual({ source: "YouTube", basis: "funnel" });
  });

  it("holds an approved family with no origin, never defaulting to Marketing", () => {
    const lead = { ...youtube, funnel: "Reactivation Scrapers" };
    const [d] = decide([meeting()], lead);
    expect(d).toMatchObject({
      disposition: "held",
      reason: "source_unavailable",
      bookedBy: null,
    });
  });

  it("excludes an unapproved title even with a known source", () => {
    const [d] = decide([meeting({ title: "Intro chat" })]);
    expect(d).toMatchObject({
      disposition: "excluded",
      reason: "unapproved_title",
    });
  });

  it("excludes generic follow-ups and setter-only callers", () => {
    const [f] = decide([meeting({ title: "Vending Strategy Call Follow Up" })]);
    expect(f.reason).toBe("follow_up_title");
    const [s] = decide([
      meeting({ userId: "user_4sfuKGMbv0LQZ4hpS8ipASv406kKTSNP5Xx79jOwSqM" }),
    ]);
    expect(s.reason).toBe("not_sales_call");
  });
});

describe("status", () => {
  it("excludes canceled, declined and native Rescheduled outcomes", () => {
    for (const over of [
      { status: "canceled" },
      { status: "declined-by-lead" },
      { status: "declined-by-org" },
      { outcome: "Rescheduled" },
      { title: "Canceled: Vending Strategy Call" },
    ]) {
      const [d] = decide([meeting(over)]);
      expect(d.reason).toBe("canceled");
    }
  });

  it("still counts a No Show", () => {
    const [d] = decide([meeting({ status: "completed", outcome: "No Show" })]);
    expect(d.disposition).toBe("counted");
  });

  it("a canceled mapped title does not count", () => {
    const [d] = decide([
      meeting({ title: "Vendingpreneur Next Steps", status: "canceled" }),
    ]);
    expect(d).toMatchObject({ disposition: "excluded", bookedBy: "Lane 2" });
  });
});

describe("60-day rule", () => {
  it("day 59 is suppressed, day 60 counts", () => {
    const prior = meeting({
      startsAt: "2026-08-10T18:00:00Z",
      dateCreated: "2026-08-01T18:00:00Z",
    });
    const day59 = meeting({ startsAt: "2026-10-08T18:00:00Z" });
    const day60 = meeting({
      startsAt: "2026-10-09T18:00:00Z",
      leadId: "lead_b",
    });
    const prior60 = { ...prior, id: "acti_prior_b", leadId: "lead_b" };
    const leads = new Map([
      ["lead_a", youtube],
      ["lead_b", youtube],
    ]);
    const out = evaluate({
      meetings: [prior, day59, prior60, day60],
      leads,
      from: FROM,
      to: TO,
    });
    expect(out.find((d) => d.meetingId === day59.id)).toMatchObject({
      reason: "repeat_within_60_days",
      intervalDays: 59,
    });
    expect(out.find((d) => d.meetingId === day60.id)).toMatchObject({
      disposition: "counted",
      intervalDays: 60,
    });
  });

  it("uses the immediately preceding scheduled meeting, even a canceled internal one", () => {
    const credited = meeting({
      startsAt: "2026-06-01T18:00:00Z",
      dateCreated: "2026-05-20T18:00:00Z",
    });
    const followUp = meeting({
      title: "Team sync",
      status: "canceled",
      startsAt: "2026-09-25T18:00:00Z",
      dateCreated: "2026-09-20T18:00:00Z",
    });
    const candidate = meeting({ startsAt: "2026-10-20T18:00:00Z" });
    const [d] = decide([credited, followUp, candidate]);
    expect(d).toMatchObject({
      reason: "repeat_within_60_days",
      intervalDays: 25,
    });
    expect(d.precedingMeetingId).toBe(followUp.id);
  });

  it("counts Pacific calendar days across a DST change", () => {
    // Jan 10 00:30 PST to Mar 11 00:00 PDT: 60 calendar days, under 60x24h.
    expect(pacificDayGap("2026-01-10T08:30:00Z", "2026-03-11T07:00:00Z")).toBe(
      60,
    );
  });

  it("dates MTD by creation, not the scheduled day", () => {
    const later = meeting({
      startsAt: "2026-11-02T18:00:00Z",
      dateCreated: "2026-10-13T18:00:00Z",
    });
    const before = meeting({
      leadId: "lead_b",
      startsAt: "2026-10-07T18:00:00Z",
      dateCreated: "2026-09-30T18:00:00Z",
    });
    const out = decide([later, before]);
    expect(out.map((d) => d.meetingId)).toEqual([later.id]);
    expect(out[0]).toMatchObject({
      createdDay: "2026-10-13",
      disposition: "counted",
    });
  });
});

describe("episodes", () => {
  it("holds a visible reschedule without a parent link", () => {
    const [t] = decide([
      meeting({ title: "Rescheduled: Vending Strategy Call" }),
    ]);
    expect(t).toMatchObject({
      disposition: "held",
      reason: "unlinked_reschedule",
    });
    const [n] = decide([meeting({ rescheduleNote: true })]);
    expect(n.reason).toBe("unlinked_reschedule");
  });

  it("holds two live meetings at the same start rather than picking one", () => {
    const out = decide([meeting(), meeting()]);
    expect(out.map((d) => d.reason)).toEqual([
      "ambiguous_simultaneous",
      "ambiguous_simultaneous",
    ]);
  });
});

describe("historical exceptions", () => {
  it("Ariella Strategy counts as Lane 2 only before the cutoff", () => {
    const title = "Vending Strategy Call with Ariella";
    const [before] = decide([
      meeting({ title, dateCreated: "2026-10-13T23:59:00-07:00" }),
    ]);
    expect(before).toMatchObject({
      bookedBy: "Lane 2",
      historicalException: "ariella_strategy",
      disposition: "counted",
    });
    const after = evaluate({
      meetings: [
        meeting({
          title,
          dateCreated: "2026-10-14T07:00:00Z",
          startsAt: "2026-10-20T18:00:00Z",
        }),
      ],
      leads: new Map([["lead_a", youtube]]),
      from: FROM,
      to: "2026-10-15T07:00:00Z",
    });
    expect(after[0]).toMatchObject({
      bookedBy: "Marketing",
      historicalException: null,
    });
  });

  it("William setter-gated Quick Discovery", () => {
    const lead = { ...youtube, setterName: "William Nowak" };
    const [d] = decide([meeting({ title: "Vending Quick Discovery" })], lead);
    expect(d).toMatchObject({
      bookedBy: "Lane 2",
      historicalException: "william_setter_quick_discovery",
    });
    const [other] = decide([meeting({ title: "Vending Quick Discovery" })]);
    expect(other.reason).toBe("not_sales_call");
  });
});

describe("sources", () => {
  it("funnel wins over UTMs; retired Reactivation Scrapers falls through to UTMs", () => {
    expect(
      resolveOrigin({
        funnel: "Website",
        contactUtms: [{ source: "youtube" }],
        resourceTag: null,
      }),
    ).toEqual({ source: "Website", basis: "funnel" });
    expect(
      resolveOrigin({
        funnel: "Reactivation Scrapers",
        contactUtms: [{ source: "youtube" }],
        resourceTag: null,
      }),
    ).toEqual({ source: "YouTube", basis: "contact_utm" });
  });

  it("competing contact UTMs stay unknown", () => {
    expect(
      resolveOrigin({
        funnel: null,
        contactUtms: [{ source: "youtube" }, { source: "instagram" }],
        resourceTag: "webinar",
      }),
    ).toEqual({ source: null, basis: "unknown" });
  });
});

describe("summarize", () => {
  it("only counted rows add up; buckets sum to the total", () => {
    const out = decide([
      meeting(),
      meeting({ leadId: "lead_b", title: "Vendingpreneur Next Steps" }),
      meeting({ leadId: "lead_c", status: "canceled" }),
    ]);
    const s = summarize(out);
    expect(s.counted + s.excluded + s.held).toBe(s.candidates);
    expect(
      s.byBookedBy.Marketing +
        s.byBookedBy["Lane 2"] +
        s.byBookedBy["Social DMs"],
    ).toBe(s.counted);
  });
});
