import { describe, expect, it } from "vitest";
import type { Decision } from "@/lib/booked-calls-v2/engine";
import type { BookedPerson } from "./google-ads-booked-people";
import {
  buildOutsideScope,
  buildPeopleByChannel,
  notLoggedByHost,
} from "./people-by-channel";

const decision = (over: Partial<Decision>): Decision =>
  ({
    meetingId: "m",
    leadId: "lead",
    createdDay: "2026-10-26",
    disposition: "counted",
    reason: "counted",
    bookedBy: "Marketing",
    mappedSetter: null,
    origin: { source: "YouTube", basis: "funnel" },
    ...over,
  }) as Decision;

const build = (decisions: Decision[], extra = {}) =>
  buildPeopleByChannel({
    decisions,
    meetings: [],
    submissions: [],
    funnel: [],
    adDays: [],
    campaignNames: new Map(),
    now: new Date("2026-11-02T20:00:00Z"),
    ...extra,
  });

describe("buildPeopleByChannel", () => {
  it("adds up to the counted total and leaves out everything else", () => {
    const rows = build([
      decision({ meetingId: "a", leadId: "1" }),
      decision({ meetingId: "b", leadId: "2", bookedBy: "Lane 2" }),
      decision({
        meetingId: "c",
        leadId: "3",
        origin: { source: "Google Ads", basis: "funnel" },
      }),
      decision({
        meetingId: "d",
        leadId: "4",
        disposition: "excluded",
        reason: "canceled",
      }),
    ]);
    expect(rows.map((r) => [r.channel, r.booked])).toEqual([
      ["YouTube", 2],
      ["Google Ads", 1],
    ]);
    expect(rows[0]).toMatchObject({ marketing: 1, lane2: 1, socialDms: 0 });
  });

  it("files a call with no source under Unknown, last, however many", () => {
    const rows = build([
      decision({ meetingId: "a", leadId: "1" }),
      ...["b", "c"].map((id) =>
        decision({
          meetingId: id,
          leadId: id,
          origin: { source: null, basis: "unknown" },
        }),
      ),
    ]);
    expect(rows.map((r) => r.channel)).toEqual([
      "YouTube",
      "Unknown (Needs Review)",
    ]);
  });

  it("counts shows, qualified and won per channel, with Close's source when no form", () => {
    const [row] = build([decision({ meetingId: "a", leadId: "1" })], {
      meetings: [
        {
          id: "a",
          leadId: "1",
          title: "x",
          status: "completed",
          outcome: "Completed",
          startsAt: "2026-10-28T20:00:00Z",
          dateCreated: "2026-10-26T20:00:00Z",
        },
      ],
      funnel: [
        {
          lead_id: "1",
          display_name: "Pat",
          first_sales_call_booked_date: null,
          first_call_show_up: null,
          qualified: "Yes",
          status_label: "🏆 Closed / Won",
          entry_source: "Webinar Oct 6",
        },
      ],
    });
    expect(row).toMatchObject({ qualified: 1, won: 1 });
    expect(row.shows.Showed).toBe(1);
    expect(row.people[0].ad.note).toBe("Close says: Webinar Oct 6");
    expect(row.people[0].closeStatus).toBe("Closed / Won");
  });
});

describe("buildOutsideScope", () => {
  it("lists calls the owner scope dropped, and keeps them out of the channels", () => {
    const decisions = [
      decision({ meetingId: "a", leadId: "1" }),
      decision({
        meetingId: "b",
        leadId: "2",
        disposition: "excluded",
        reason: "outside_booking_scope",
      }),
    ];
    const inputs = {
      decisions,
      meetings: [],
      submissions: [],
      funnel: [],
      adDays: [],
      campaignNames: new Map(),
      now: new Date("2026-11-02T20:00:00Z"),
    };
    expect(buildPeopleByChannel(inputs)[0].booked).toBe(1);
    expect(buildOutsideScope(inputs).map((p) => [p.leadId, p.channel])).toEqual(
      [["2", "YouTube"]],
    );
  });
});

describe("notLoggedByHost", () => {
  const person = (host: string | null, show: BookedPerson["show"]) =>
    ({ host, show }) as BookedPerson;

  it("counts held calls per host, worst first, leaving out upcoming calls", () => {
    expect(
      notLoggedByHost([
        person("Ana", "Not logged"),
        person("Ana", "Showed"),
        person("Ana", "Upcoming"),
        person("Ben", "Not logged"),
        person("Ben", "Not logged"),
        person("Cal", "Showed"),
        person(null, "Not logged"),
      ]),
    ).toEqual([
      { host: "Ben", held: 2, notLogged: 2 },
      { host: "Ana", held: 2, notLogged: 1 },
      { host: "No host on the meeting", held: 1, notLogged: 1 },
    ]);
  });
});
