import { describe, expect, it } from "vitest";
import {
  type BookedLead,
  chatFunnel,
  creditBySource,
  siteFormFunnel,
  type Touches,
} from "./marketing-credit";

const none: Touches = {
  forms: new Map(),
  chats: new Map(),
  setters: new Map(),
};

function lead(o: Partial<BookedLead> = {}): BookedLead {
  return {
    leadId: "l1",
    email: "a@example.com",
    entrySource: "Webinar",
    funnel: "Internal Webinar",
    bookedBy: null,
    bookedDay: "2026-10-10",
    ...o,
  };
}

describe("creditBySource", () => {
  it("splits each source into booked themselves vs by a setter", () => {
    const rows = creditBySource(
      [
        lead(),
        lead({ leadId: "l2", email: "b@x.com", bookedBy: "Lane 2" }),
        lead({
          leadId: "l3",
          email: "c@x.com",
          funnel: "Reactivation Scrapers",
        }),
        lead({
          leadId: "l4",
          email: "d@x.com",
          entrySource: "Rep-Outbound",
          funnel: "Reactivation Scrapers",
        }),
      ],
      [],
      new Map(),
      none,
    );
    const webinar = rows.find((r) => r.source === "Webinar")!;
    expect([webinar.booked, webinar.themselves, webinar.bySetter]).toEqual([
      3, 1, 2,
    ]);
    expect(rows.find((r) => r.source === "No marketing touch")!.bySetter).toBe(
      1,
    );
  });

  it("credits a site form only when it came on or before the booked day", () => {
    const touches: Touches = {
      ...none,
      forms: new Map([["a@example.com", ["2026-10-11"]]]),
    };
    const rows = creditBySource(
      [lead({ entrySource: "Rep-Outbound" })],
      [],
      new Map(),
      touches,
    );
    expect(rows.find((r) => r.source === "No marketing touch")!.booked).toBe(1);
  });

  it("puts wins under their lead's source, and unknown leads under no touch", () => {
    const rows = creditBySource(
      [],
      [
        { leadId: "l1", value: 6000, dateWon: "2026-10-20" },
        { leadId: "zz", value: 1000, dateWon: "2026-10-20" },
      ],
      new Map([["l1", lead()]]),
      none,
    );
    expect(rows.find((r) => r.source === "Webinar")).toMatchObject({
      won: 1,
      revenue: 6000,
    });
    expect(rows.find((r) => r.source === "No marketing touch")).toMatchObject({
      won: 1,
      revenue: 1000,
    });
  });
});

describe("siteFormFunnel", () => {
  it("counts people once and splits booked by who booked", () => {
    const f = siteFormFunnel(
      [
        {
          email: "a@x.com",
          callBookedAt: "2026-10-02",
          bookedBySetter: null,
          callStatus: "☎️ Call Booked",
        },
        {
          email: "A@x.com ",
          callBookedAt: null,
          bookedBySetter: null,
          callStatus: null,
        },
        {
          email: "b@x.com",
          callBookedAt: "2026-10-03",
          bookedBySetter: "Connor George",
          callStatus: null,
        },
        {
          email: "c@x.com",
          callBookedAt: "2026-10-04",
          bookedBySetter: null,
          callStatus: null,
        },
        {
          email: "d@x.com",
          callBookedAt: null,
          bookedBySetter: null,
          callStatus: "🆕 New",
        },
      ],
      new Map([
        [
          "c@x.com",
          lead({ email: "c@x.com", funnel: "Reactivation Scrapers" }),
        ],
      ]),
    );
    expect(f.filled).toBe(4);
    expect(f.bookedThemselves).toBe(1);
    expect(f.bookedBySetter).toEqual([
      { setter: "Connor George", count: 1 },
      { setter: "Reactivation team", count: 1 },
    ]);
    expect(f.notBooked).toEqual([{ status: "New", count: 1 }]);
  });
});

describe("chatFunnel", () => {
  it("separates in-chat bookings from later ones", () => {
    expect(
      chatFunnel([
        {
          capturedEmail: "a",
          bookedInChat: true,
          leadBookedAt: "x",
          leadSetter: null,
        },
        {
          capturedEmail: "b",
          bookedInChat: false,
          leadBookedAt: "x",
          leadSetter: "Pearl",
        },
        {
          capturedEmail: null,
          bookedInChat: false,
          leadBookedAt: "x",
          leadSetter: null,
        },
        {
          capturedEmail: null,
          bookedInChat: false,
          leadBookedAt: null,
          leadSetter: null,
        },
      ]),
    ).toEqual({
      chats: 4,
      gaveEmail: 2,
      bookedInChat: 1,
      bookedLaterThemselves: 1,
      bookedLaterBySetter: 1,
    });
  });
});
