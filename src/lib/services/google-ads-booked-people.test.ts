import { describe, expect, it } from "vitest";
import type { Decision, Meeting } from "@/lib/booked-calls-v2/engine";
import {
  adFor,
  buildBookedPeople,
  closeTags,
  showOf,
  type AdDayRow,
  type FunnelRow,
  type SubmissionRow,
} from "./google-ads-booked-people";

const NOW = new Date("2026-11-02T20:00:00Z");

const meeting = (over: Partial<Meeting> = {}): Meeting =>
  ({
    id: "m1",
    leadId: "lead1",
    title: "Pat and Vendingprenuers Consultation",
    status: "completed",
    outcome: null,
    startsAt: "2026-10-28T20:00:00Z",
    dateCreated: "2026-10-26T20:00:00Z",
    ...over,
  }) as Meeting;

const funnel = (over: Partial<FunnelRow> = {}): FunnelRow => ({
  lead_id: "lead1",
  display_name: "Pat Doe",
  first_sales_call_booked_date: "2026-10-28",
  first_call_show_up: null,
  qualified: "Yes",
  status_label: "📞 Hot",
  ...over,
});

const submission = (over: Partial<SubmissionRow> = {}): SubmissionRow => ({
  close_lead_id: "lead1",
  full_name: "Pat Form",
  created_at: "2026-10-26T18:00:00Z",
  utm_campaign: "111",
  utm_term: "vending business",
  utm_content: "222",
  qualification_summary: { available_capital: "15k_plus" },
  gclid: "g1",
  ...over,
});

const adDay = (over: Partial<AdDayRow> = {}): AdDayRow => ({
  day: "2026-10-26",
  campaign_id: "111",
  ad_group_id: "222",
  ad_group_name: "Research",
  ad_id: "a1",
  headlines: ["Start a Vending Business", "Coaching"],
  clicks: 3,
  ...over,
});

const decision = (over: Partial<Decision> = {}): Decision =>
  ({
    meetingId: "m1",
    leadId: "lead1",
    createdDay: "2026-10-26",
    disposition: "counted",
    reason: "counted",
    bookedBy: "Marketing",
    origin: { source: "Google Ads", basis: "funnel" },
    ...over,
  }) as Decision;

describe("showOf", () => {
  it("reads the meeting outcome first", () => {
    expect(showOf(meeting({ outcome: "Completed" }), funnel(), NOW)).toBe(
      "Showed",
    );
    expect(showOf(meeting({ outcome: "No Show" }), funnel(), NOW)).toBe(
      "No-show",
    );
  });

  it("fills a blank outcome from First Call Show Up only on the first call's day", () => {
    const yes = funnel({ first_call_show_up: "Yes" });
    expect(showOf(meeting(), yes, NOW)).toBe("Showed");
    expect(
      showOf(meeting({ startsAt: "2026-10-30T20:00:00Z" }), yes, NOW),
    ).toBe("Not logged");
  });

  it("does not call a future meeting a show or no-show", () => {
    const future = meeting({ startsAt: "2026-11-05T20:00:00Z" });
    expect(showOf(future, funnel({ first_call_show_up: "No" }), NOW)).toBe(
      "Upcoming",
    );
  });
});

describe("closeTags", () => {
  const row = (resource_tag: string | null, contact_utms: unknown) => ({
    lead_id: "lead1",
    resource_tag,
    contact_utms,
  });

  it("leads with the resource tag, then contact source and medium", () => {
    expect(
      closeTags(
        row("webinar-27-oct", [
          { source: "fb", medium: "Facebook_Mobile_Reels" },
        ]),
      ),
    ).toBe("webinar-27-oct · fb · Facebook_Mobile_Reels");
  });

  it("shows a repeated value once and drops Close's underscore blanks", () => {
    expect(
      closeTags(
        row("internal-webinar", [
          { source: "Internal-Webinar", medium: "_____" },
        ]),
      ),
    ).toBe("Internal-Webinar");
  });

  it("is null with nothing to show, whatever shape the column holds", () => {
    expect(closeTags(undefined)).toBeNull();
    expect(closeTags(row(null, []))).toBeNull();
    expect(closeTags(row(null, "not an array"))).toBeNull();
  });
});

describe("adFor", () => {
  const names = new Map([["111", "VP | W2"]]);

  it("names the ad when one ad in the group had clicks", () => {
    const ad = adFor(submission(), [adDay()], names);
    expect(ad).toMatchObject({
      campaign: "VP | W2",
      adGroup: "Research",
      keyword: "vending business",
      possibleAds: 1,
    });
    expect(ad.headlines[0]).toBe("Start a Vending Business");
  });

  it("does not guess between ads, and narrows to the lead's day first", () => {
    const two = [
      adDay({ day: "2026-10-20", ad_id: "a2" }),
      adDay({ day: "2026-10-21" }),
    ];
    expect(adFor(submission(), two, names)).toMatchObject({
      headlines: [],
      possibleAds: 2,
    });
    const narrowed = adFor(
      submission(),
      [...two, adDay({ day: "2026-10-26", ad_id: "a3" })],
      names,
    );
    expect(narrowed.possibleAds).toBe(1);
  });

  it("says when a lead's tags are not a Google campaign", () => {
    const ad = adFor(
      submission({ utm_campaign: "hunter", utm_content: "desc" }),
      [],
      names,
    );
    expect(ad.note).toContain("hunter");
    expect(ad.campaign).toBeNull();
  });
});

describe("buildBookedPeople", () => {
  const base = {
    meetings: [meeting({ outcome: "Completed" })],
    funnel: [funnel()],
    adDays: [adDay()],
    campaignNames: new Map([["111", "VP | W2"]]),
    now: NOW,
  };

  it("counts only meetings Dom's rule credits to Google Ads", () => {
    const people = buildBookedPeople({
      ...base,
      decisions: [
        decision(),
        decision({
          meetingId: "m2",
          leadId: "lead2",
          origin: { source: "YouTube", basis: "funnel" },
        }),
      ],
      submissions: [submission()],
      headlineLeads: [],
    });
    expect(people.counted.map((p) => p.name)).toEqual(["Pat Doe"]);
    expect(people.counted[0]).toMatchObject({
      show: "Showed",
      capital: "$15,000+",
      closeUrl: "https://app.close.com/lead/lead1/",
      closeStatus: "Hot",
    });
  });

  it("explains every headline lead Dom's rule leaves out", () => {
    const row = (id: string, gclid: string) =>
      submission({ close_lead_id: id, gclid, full_name: id });
    const people = buildBookedPeople({
      ...base,
      decisions: [
        decision(),
        decision({
          meetingId: "m3",
          leadId: "quick",
          disposition: "excluded",
          reason: "unapproved_title",
        }),
      ],
      submissions: [submission(), row("quick", "g2"), row("outside", "g3")],
      headlineLeads: [
        submission(),
        row("quick", "g2"),
        row("outside", "g3"),
        submission({ close_lead_id: null, gclid: "g4", full_name: "No Close" }),
      ],
    });
    expect(people.counted).toHaveLength(1);
    expect(
      Object.fromEntries(
        people.alsoInHeadline.map((p) => [p.name, p.whyNotCounted]),
      ),
    ).toEqual({
      quick: "Call type not counted",
      outside: "Call booked outside these dates",
      "No Close": "Not linked to a Close lead",
    });
  });
});
