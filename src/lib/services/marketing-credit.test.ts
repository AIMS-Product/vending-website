import { describe, expect, it } from "vitest";
import {
  type BookedLead,
  creditBySource,
  sourceOf,
  sumRows,
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

describe("sourceOf", () => {
  it("uses Close's entry source, a chat before booking wins, a later form does not count", () => {
    expect(sourceOf(lead(), "2026-10-10", none)).toBe("Webinar");
    const chatted: Touches = {
      ...none,
      chats: new Map([["a@example.com", ["2026-10-09"]]]),
    };
    expect(sourceOf(lead(), "2026-10-10", chatted)).toBe("Chatbot");
    const lateForm: Touches = {
      ...none,
      forms: new Map([["a@example.com", ["2026-10-11"]]]),
    };
    expect(
      sourceOf(lead({ entrySource: "Rep-Outbound" }), "2026-10-10", lateForm),
    ).toBe("No marketing touch");
  });
});

describe("creditBySource", () => {
  it("splits booked and closed into themselves vs reactivated, per source", () => {
    const rows = creditBySource(
      [
        lead(),
        lead({ leadId: "l2", email: "b@x.com", bookedBy: "Lane 2" }),
        lead({
          leadId: "l3",
          email: "c@x.com",
          funnel: "Reactivation Scrapers",
        }),
      ],
      [
        { leadId: "l1", value: 6000, dateWon: "2026-10-20" },
        { leadId: "l3", value: 9000, dateWon: "2026-10-21" },
        { leadId: "unknown", value: 1000, dateWon: "2026-10-21" },
      ],
      new Map([
        ["l1", lead()],
        [
          "l3",
          lead({
            leadId: "l3",
            email: "c@x.com",
            funnel: "Reactivation Scrapers",
          }),
        ],
      ]),
      none,
      { Webinar: 1500 },
    );
    const webinar = rows.find((r) => r.source === "Webinar")!;
    expect(webinar.entered).toBe(1500);
    expect(webinar.booked).toEqual({ self: 1, reactivated: 2 });
    expect(webinar.won).toEqual({ self: 1, reactivated: 1 });
    expect(webinar.revenue).toEqual({ self: 6000, reactivated: 9000 });
    const noTouch = rows.find((r) => r.source === "No marketing touch")!;
    expect(noTouch.won).toEqual({ self: 1, reactivated: 0 });
    expect(rows.find((r) => r.source === "Chatbot")!.entered).toBeNull();
    expect(sumRows(rows).revenue).toEqual({ self: 7000, reactivated: 9000 });
  });

  it("counts a named setter on the site lead as reactivated", () => {
    const touches: Touches = {
      ...none,
      setters: new Map([["a@example.com", "Connor George"]]),
    };
    const rows = creditBySource([lead()], [], new Map(), touches);
    expect(rows[0].booked).toEqual({ self: 0, reactivated: 1 });
  });
});
