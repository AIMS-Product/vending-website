import { describe, expect, it } from "vitest";
import {
  NO_SOURCE_LABEL,
  buildCloseWeeks,
  recentWeeks,
  weekStartOf,
} from "./close-week-view";

describe("weekStartOf", () => {
  it("runs Friday to Thursday", () => {
    expect(weekStartOf("2026-09-11")).toBe("2026-09-11"); // Fri
    expect(weekStartOf("2026-09-17")).toBe("2026-09-11"); // Thu
    expect(weekStartOf("2026-09-18")).toBe("2026-09-18"); // next Fri
    expect(weekStartOf("2026-09-14T23:00:00Z")).toBe("2026-09-11");
  });

  it("lists recent weeks newest first", () => {
    expect(recentWeeks("2026-09-19", 3)).toEqual([
      "2026-09-18",
      "2026-09-11",
      "2026-09-04",
    ]);
  });
});

describe("buildCloseWeeks", () => {
  const week = "2026-09-11";

  it("counts first calls by booked date and outcomes only when a rep logged Yes", () => {
    const [result] = buildCloseWeeks({
      weeks: [week],
      today: "2026-09-19",
      calls: [
        {
          funnel: "YouTube",
          status: null,
          bookedDate: "2026-09-12",
          showUp: "Yes",
          qualified: "Yes",
        },
        {
          funnel: "YouTube",
          status: null,
          bookedDate: "2026-09-17",
          showUp: "No",
          qualified: null,
        },
        // Unlogged show-up is not a show.
        {
          funnel: "YouTube",
          status: null,
          bookedDate: "2026-09-15",
          showUp: null,
          qualified: null,
        },
        {
          funnel: null,
          status: null,
          bookedDate: "2026-09-16",
          showUp: "yes",
          qualified: "No",
        },
        // Outside the week.
        {
          funnel: "YouTube",
          status: null,
          bookedDate: "2026-09-18",
          showUp: "Yes",
          qualified: "Yes",
        },
      ],
      deals: [],
    });
    expect(result!.complete).toBe(true);
    expect(result!.totals).toMatchObject({
      booked: 4,
      showed: 2,
      qualified: 1,
    });
    expect(result!.rows.find((r) => r.label === "YouTube")).toMatchObject({
      booked: 3,
      showed: 1,
      qualified: 1,
    });
    // A call with no funnel is kept and named, never dropped.
    expect(result!.rows.find((r) => r.label === NO_SOURCE_LABEL)?.booked).toBe(
      1,
    );
  });

  it("dates wins by the day won, credits the funnel, keeps unvalued deals out of revenue", () => {
    const [result] = buildCloseWeeks({
      weeks: [week],
      today: "2026-09-15",
      calls: [],
      deals: [
        {
          leadId: "a",
          dateWon: "2026-09-13",
          value: 5997,
          funnel: "Internal Webinar",
          closer: null,
        },
        {
          leadId: "b",
          dateWon: "2026-09-17",
          value: null,
          funnel: "Internal Webinar",
          closer: null,
        },
        {
          leadId: "c",
          dateWon: "2026-09-10",
          value: 9999,
          funnel: "Internal Webinar",
          closer: null,
        },
      ],
    });
    expect(result!.complete).toBe(false);
    expect(result!.rows).toEqual([
      {
        label: "Internal Webinar",
        booked: 0,
        showed: 0,
        qualified: 0,
        won: 2,
        revenue: 5997,
      },
    ]);
    expect(result!.unvalued).toBe(1);
  });

  it("leaves out canceled-by-lead, outside-the-US and quiz-funnel calls, and counts them", () => {
    const call = (status: string | null, funnel = "Instagram") => ({
      funnel,
      status,
      bookedDate: "2026-09-14",
      showUp: "Yes",
      qualified: "Yes",
    });
    const [result] = buildCloseWeeks({
      weeks: [week],
      today: "2026-09-19",
      calls: [
        call("🔻 Canceled (by Lead)"),
        call("🌎 Outside the US"),
        call("📞 Follow Up", "LTF - Quiz Funnel"),
        call("👻 No Show"),
        call("🕛 Reschedule"),
      ],
      deals: [],
    });
    expect(result!.totals).toMatchObject({
      booked: 2,
      showed: 2,
      qualified: 2,
    });
    expect(result!.excluded).toBe(3);
  });

  it("returns an empty week rather than dropping it", () => {
    const [result] = buildCloseWeeks({
      weeks: [week],
      today: "2026-09-19",
      calls: [],
      deals: [],
    });
    expect(result!.rows).toEqual([]);
    expect(result!.totals.booked).toBe(0);
  });
});
