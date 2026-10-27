import { describe, expect, it } from "vitest";
import {
  evaluate,
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
    ...over,
  };
}

const youtube: LeadFacts = {
  funnel: "YouTube",
  contactUtms: [],
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
    ["Vendingpreneurs - Next Steps Call", "Charlie Ingram", "Lane 2"],
    ["Vendingpreneurs Next Steps Call", "Vince Bartolini", "Lane 2"],
    ["Vendingpreneurs Next Steps Session", "Pearl Sathekge", "Social DMs"],
    ["Vendingpreneurs Discovery - Next Steps", "Kelly Schrader", "Lane 2"],
    ["Vendingpreneur Next Steps", "William Nowak", "Lane 2"],
    ["Vending Discovery Call - Next Steps", "August Young", "Lane 2"],
    ["Vending Discovery - Next Steps", "Spencer Reynolds", "Lane 2"],
    ["Vendingpreneurs Rescheduled Call - Ariella", "Ariella Irvine", "Lane 2"],
    [
      "New Vendingpreneurs Strategy Call with Ariella",
      "Ariella Irvine",
      "Lane 2",
    ],
    ["Vendingpreneurs Follow-Up with Ariella", "Ariella Irvine", "Lane 2"],
    ["Vendingpreneurs Strategy - Next Steps", "Amy Mulch", "Lane 2"],
    ["Vending Opportunity - Next Steps", "Cassie Caraballo", "Lane 2"],
    ["Vendingpreneurs Connect - Next Steps", "Jessica Zatkin", "Lane 2"],
    ["Vendingpreneurs Momentum - Next Steps", "Connor George", "Lane 2"],
    ["Vendingpreneurs Pathway - Next Steps", "Naria Torres", "Lane 2"],
    ["Vendingpreneurs Blueprint - Next Steps", "Melia King", "Lane 2"],
    ["Vending Consult Call", "William Nowak", "Lane 2"],
    [
      "Vendingpreneurs Quick Discovery - William Nowak",
      "William Nowak",
      "Lane 2",
    ],
    ["TLG Compass - Next Steps", "Josh Stoffel", "Lane 2"],
    [
      "Vendingpreneurs Horizon - Next Steps",
      "Beatrice Braescu Cojocaru",
      "Lane 2",
    ],
    ["TLG Elevate - Next Steps", "Catalina Villalba-Gallego", "Lane 2"],
    ["TLG Clarity - Next Steps", "Luna Mattey", "Lane 2"],
    ["Vendingpreneurs Ascent - Next Steps", "Owen Hart", "Lane 2"],
    ["Vendingpreneurs Keystone - Next Steps", "Brad Savage", "Lane 2"],
    ["PPA Pinnacle - Next Steps", "Jessica Hernandez", "Lane 2"],
    ["Vendingpreneurs Summit - Next Steps", "Rob Maxfield", "Lane 2"],
    ["Vendingpreneurs Growth - Next Steps", "Igor Trojanowski", "Lane 2"],
    ["TLG Northstar - Next Steps", "Jonathan Quinn", "Lane 2"],
    ["TLG Pinnacle - Next Steps", "Kaylane Nunes", "Lane 2"],
    ["PPA Growth - Next Steps", "Tony Parton", "Lane 2"],
    ["Vendingpreneurs Enterprise - Next Steps", "Ashley Atencio", "Lane 2"],
    ["Vendingpreneurs Velocity - Next Steps", "Ibraheem Khan", "Lane 2"],
    ["Vendingpreneurs Executive Next Steps", "Finley Eastlake", "Lane 2"],
    ["Vendingpreneurs Pinnacle Next Steps", "Monde Janzen", "Lane 2"],
  ];

  it("has exactly Dom's 35 v2.6 title rules", () => {
    expect(TITLE_MAP).toHaveLength(35);
  });

  it.each(cases)("%s -> %s (%s)", (title, setter, bucket) => {
    const lead = title.includes("Quick Discovery")
      ? youtube
      : { ...youtube, setterName: "Someone Else" };
    const [d] = decide([meeting({ title })], lead);
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

  it("no longer credits the retired TLG Vanguard title", () => {
    const [d] = decide([meeting({ title: "TLG Vanguard - Next Steps" })]);
    expect(d).toMatchObject({
      disposition: "excluded",
      reason: "follow_up_title",
    });
  });

  it("bare Quick Discovery is William's only when he is the lead's setter", () => {
    const title = "Vendingpreneurs Quick Discovery";
    const [his] = decide([meeting({ title })], {
      ...youtube,
      setterName: "William Nowak",
    });
    expect(his).toMatchObject({ disposition: "counted", bookedBy: "Lane 2" });
    const [other] = decide([meeting({ title })]);
    expect(other.disposition).not.toBe("counted");
  });

  it("counts a mapped title with no origin as Lane 2, source unknown", () => {
    const [d] = decide([meeting({ title: "Vendingpreneur Next Steps" })], null);
    expect(d).toMatchObject({ disposition: "counted", bookedBy: "Lane 2" });
    expect(d.origin.source).toBeNull();
  });
});

describe("Pearl's Social DMs", () => {
  const pearl = { ...youtube, setterName: "Pearl Sathekge" };

  it("setter name alone does not make source titles Social DMs", () => {
    for (const title of [
      "Vendingpreneurs Consultation",
      "New Vendingpreneur Strategy Call with Oscar Pugh",
    ]) {
      const [d] = decide([meeting({ title })], pearl);
      expect(d).toMatchObject({
        disposition: "counted",
        bookedBy: "Marketing",
        mappedSetter: null,
      });
    }
  });

  it("a contact from her GoHighLevel link or Mike's IG DMs gates the same way", () => {
    for (const source of ["ghl", "Mike-IG", "instagram"]) {
      const [d] = decide([meeting({ title: "Vendingpreneurs Consultation" })], {
        ...youtube,
        funnel: "Internal Webinar",
        contactUtms: [{ source }],
      });
      expect(d).toMatchObject({
        bookedBy: "Social DMs",
        origin: { source: "Internal Webinar" },
      });
    }
  });

  it("the same titles stay Marketing for anyone else's lead", () => {
    const [d] = decide([meeting({ title: "Vendingpreneurs Consultation" })]);
    expect(d).toMatchObject({ disposition: "counted", bookedBy: "Marketing" });
  });
});

describe("marketing credit", () => {
  it("counts an approved family with a supported origin", () => {
    const [d] = decide([meeting()]);
    expect(d).toMatchObject({ disposition: "counted", bookedBy: "Marketing" });
    expect(d.origin).toEqual({ source: "YouTube", basis: "funnel" });
  });

  it("counts Marketing with an unresolved source in its own review channel", () => {
    const lead = { ...youtube, funnel: "Reactivation Scrapers" };
    const [d] = decide([meeting()], lead);
    expect(d).toMatchObject({
      disposition: "counted",
      reason: "counted",
      bookedBy: "Marketing",
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
  it("excludes canceled and declined meetings", () => {
    for (const over of [
      { status: "canceled" },
      { status: "cancelled" },
      { status: "declined-by-lead" },
      { status: "declined-by-org" },
      { status: "completed", outcome: "Cancelled" },
      { title: "Canceled: Vending Strategy Call" },
    ]) {
      const [d] = decide([meeting(over)]);
      expect(d.reason).toBe("canceled");
    }
  });

  it("holds an unknown status for review", () => {
    const [d] = decide([meeting({ status: "draft" })]);
    expect(d).toMatchObject({ disposition: "held", reason: "unknown_status" });
  });

  it("still counts a No Show and a native Rescheduled outcome", () => {
    for (const outcome of ["No Show", "Rescheduled"]) {
      const [d] = decide([meeting({ status: "completed", outcome })]);
      expect(d.disposition).toBe("counted");
    }
  });

  it("a canceled mapped title does not count", () => {
    const [d] = decide([
      meeting({ title: "Vendingpreneur Next Steps", status: "canceled" }),
    ]);
    expect(d).toMatchObject({ disposition: "excluded", bookedBy: "Lane 2" });
  });

  it("cancellation takes precedence in the audit reason", () => {
    const [d] = decide([
      meeting({ title: "Webinar Actions Review", status: "canceled" }),
    ]);
    expect(d.reason).toBe("canceled");
  });

  it("excludes setter-only and non-booking titles as not sales calls", () => {
    for (const title of [
      "Vending Quick Discovery",
      "Route Planning Call",
      "Bronze Enrollment",
      "Silver Start Up Walkthrough",
    ]) {
      const [d] = decide([meeting({ title })]);
      expect(d.disposition).toBe("excluded");
    }
  });
});

describe("30 x 24 hour episodes", () => {
  const H = 3_600_000;
  const at = (iso: string, hours: number) =>
    new Date(Date.parse(iso) + hours * H).toISOString();
  const START = "2026-09-20T18:00:00Z";
  // Only Lane 2 and Social DM credits run on episodes.
  const lane2 = (over: Partial<Meeting> = {}) =>
    meeting({ title: "Vendingpreneur Next Steps", ...over });

  it("both 719 and exactly 720 elapsed hours suppress a repeat", () => {
    const credit = lane2({
      startsAt: START,
      dateCreated: "2026-09-10T18:00:00Z",
    });
    const inside = lane2({ startsAt: at(START, 719) });
    const lead_b = { leadId: "lead_b" };
    const creditB = { ...credit, id: "acti_credit_b", ...lead_b };
    const outside = lane2({ startsAt: at(START, 720), ...lead_b });
    const out = evaluate({
      meetings: [credit, inside, creditB, outside],
      leads: new Map([
        ["lead_a", youtube],
        ["lead_b", youtube],
      ]),
      from: FROM,
      to: TO,
    });
    expect(out.find((d) => d.meetingId === inside.id)).toMatchObject({
      reason: "within_episode",
      precedingMeetingId: credit.id,
      intervalDays: 29,
    });
    expect(out.find((d) => d.meetingId === outside.id)).toMatchObject({
      disposition: "excluded",
      intervalDays: 30,
    });
  });

  it("canceled meetings do not start the timer; unapproved meetings do", () => {
    const canceled = meeting({
      status: "canceled",
      startsAt: "2026-09-25T18:00:00Z",
      dateCreated: "2026-09-20T18:00:00Z",
    });
    const internal = meeting({
      title: "Team sync",
      startsAt: "2026-09-28T18:00:00Z",
      dateCreated: "2026-09-20T18:00:00Z",
    });
    const rebooked = lane2({ startsAt: "2026-10-08T18:00:00Z" });
    const out = decide([canceled, internal, rebooked]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      meetingId: rebooked.id,
      disposition: "excluded",
      precedingMeetingId: internal.id,
    });
  });

  it("a no-show keeps its credit; its reschedule earns none", () => {
    const noShow = lane2({
      status: "completed",
      outcome: "No Show",
      startsAt: "2026-10-03T18:00:00Z",
      dateCreated: "2026-10-01T18:00:00Z",
    });
    const moved = lane2({ startsAt: "2026-10-09T18:00:00Z" });
    const out = decide([noShow, moved]);
    expect(out.map((d) => [d.meetingId, d.reason])).toEqual([
      [noShow.id, "counted"],
      [moved.id, "within_episode"],
    ]);
  });

  it("unknown-source Marketing counts and advances the repeat clock", () => {
    const scrapers = { ...youtube, funnel: "Reactivation Scrapers" };
    const held = meeting({ startsAt: "2026-10-03T18:00:00Z" });
    const mapped = meeting({
      title: "Vendingpreneur Next Steps",
      startsAt: "2026-10-09T18:00:00Z",
    });
    const out = decide([held, mapped], scrapers);
    expect(out.map((d) => d.reason)).toEqual(["counted", "within_episode"]);
  });

  it("simultaneous meetings: earliest created, then lowest id, takes the credit", () => {
    const later = lane2({ dateCreated: "2026-10-05T19:00:00Z" });
    const earlier = lane2({ dateCreated: "2026-10-05T18:00:00Z" });
    const out = decide([later, earlier]);
    expect(out.find((d) => d.meetingId === earlier.id)?.reason).toBe("counted");
    expect(out.find((d) => d.meetingId === later.id)?.reason).toBe(
      "within_episode",
    );
  });

  it("Marketing is not repeat-limited but advances the shared repeat clock", () => {
    const first = meeting({ startsAt: "2026-10-03T18:00:00Z" });
    const again = meeting({ startsAt: "2026-10-06T18:00:00Z" });
    const setter = lane2({ startsAt: "2026-10-09T18:00:00Z" });
    const out = decide([first, again, setter]);
    expect(out.map((d) => [d.bookedBy, d.reason])).toEqual([
      ["Marketing", "counted"],
      ["Marketing", "counted"],
      ["Lane 2", "within_episode"],
    ]);
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

  it("candidate fence does not filter full current-state meeting history", () => {
    const candidate = meeting({
      startsAt: "2026-10-20T18:00:00Z",
      dateCreated: "2026-10-05T18:00:00Z",
    });
    const later = meeting({
      startsAt: "2026-10-10T18:00:00Z",
      dateCreated: "2026-10-13T22:00:00Z",
    });
    const out = evaluate({
      meetings: [candidate, later],
      leads: new Map([["lead_a", youtube]]),
      from: FROM,
      to: "2026-10-13T21:54:08Z",
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      disposition: "counted",
      precedingMeetingId: later.id,
    });
  });

  it("holds a meeting with no scheduled time", () => {
    const [d] = decide([meeting({ startsAt: null })]);
    expect(d).toMatchObject({
      disposition: "held",
      reason: "missing_timestamp",
    });
  });
});

describe("sources", () => {
  it("funnel wins over UTMs; retired Reactivation Scrapers falls through to UTMs", () => {
    expect(
      resolveOrigin({
        funnel: "Website",
        contactUtms: [{ source: "youtube" }],
      }),
    ).toEqual({ source: "Website", basis: "funnel" });
    expect(
      resolveOrigin({
        funnel: "Reactivation Scrapers",
        contactUtms: [{ source: "youtube" }],
      }),
    ).toEqual({ source: "YouTube", basis: "contact_utm" });
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

describe("canonical any-meeting-clock regressions", () => {
  const mapped = (over: Partial<Meeting> = {}) =>
    meeting({ title: "Vendingpreneurs Next Steps Call", ...over });
  it("William consult retires at the exclusive Pacific cutoff and can fall through to Marketing", () => {
    for (const [created, bucket] of [
      ["2026-10-14T06:59:59Z", "Lane 2"],
      ["2026-10-14T07:00:00Z", "Marketing"],
    ]) {
      const [d] = evaluate({
        meetings: [
          meeting({ title: "Vending Consult Call", dateCreated: created }),
        ],
        leads: new Map([["lead_a", youtube]]),
        from: FROM,
        to: "2026-10-15T07:00:00Z",
      });
      expect(d?.bookedBy).toBe(bucket);
    }
  });
  it("raw Pearl source query tails do not pass the Social DM gate", () => {
    const [d] = decide([meeting({ title: "Vendingpreneurs Consultation" })], {
      ...youtube,
      setterName: "Pearl Sathekge",
      contactUtms: [{ source: "mike-ig?x=1" }],
    });
    expect(d?.bookedBy).toBe("Marketing");
  });
  it("mapped titles outrank excluded Marketing callers", () => {
    const [d] = decide([
      mapped({ userId: "user_4sfuKGMbv0LQZ4hpS8ipASv406kKTSNP5Xx79jOwSqM" }),
    ]);
    expect(d?.disposition).toBe("counted");
  });
  it("suppressed and held-status meetings advance the clock; exactly 720 suppresses", () => {
    const start = Date.parse("2026-09-01T18:00:00Z");
    const meetings = [0, 20, 40, 70, 101].map((days, i) =>
      mapped({
        id: `clock_${i}`,
        startsAt: new Date(start + days * 86400000).toISOString(),
        ...(i === 1 ? { status: "rescheduled", title: "Team sync" } : {}),
      }),
    );
    expect(decide(meetings).map((d) => d.reason)).toEqual([
      "counted",
      "unknown_status",
      "within_episode",
      "within_episode",
      "counted",
    ]);
  });
  it("naive creation times never become candidates; naive starts cannot count", () => {
    expect(decide([mapped({ dateCreated: "2026-10-05T18:00:00" })])).toEqual(
      [],
    );
    expect(
      decide([mapped({ startsAt: "2026-10-08T18:00:00" })])[0]?.reason,
    ).toBe("missing_timestamp");
  });
});

// Canonical regexes see the raw meeting title, including trailing whitespace.
it("does not trim a title into Pearl's anchored source-title rule", () => {
  const [d] = decide([meeting({ title: "Vendingpreneurs consultation " })], {
    ...youtube,
    contactUtms: [{ source: "ghl" }],
  });
  expect(d?.bookedBy).toBe("Marketing");
});
