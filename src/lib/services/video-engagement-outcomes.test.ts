import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { compareShowUp, firstCallOutcome } =
  await import("./video-engagement-outcomes");

const row = (date: string, answer: string | null) => ({
  email: "a@x.com",
  first_sales_call_booked_date: date,
  first_call_show_up: answer,
});

describe("firstCallOutcome", () => {
  it("matches an evening Pacific call that is already the next day in UTC", () => {
    // 6pm PT on the 24th is 01:00 UTC on the 25th; Close says the 24th.
    expect(
      firstCallOutcome(
        { inviteeEmail: "a@x.com", startAt: "2026-09-25T01:00:00Z" },
        [row("2026-09-24", "yes")],
        "2026-09-30",
      ),
    ).toBe("held");
  });

  it("will not read another call's answer onto this booking", () => {
    expect(
      firstCallOutcome(
        { inviteeEmail: "a@x.com", startAt: "2026-09-25T17:00:00Z" },
        [row("2026-09-10", "no")],
        "2026-09-30",
      ),
    ).toBe("notFirstCall");
  });

  it("picks the matching row when an email has several", () => {
    expect(
      firstCallOutcome(
        { inviteeEmail: "a@x.com", startAt: "2026-09-25T17:00:00Z" },
        [row("2026-08-01", "yes"), row("2026-09-25", "no")],
        "2026-09-30",
      ),
    ).toBe("noShow");
  });

  it("is pending until the grace day has passed, then unlogged if blank", () => {
    const booking = {
      inviteeEmail: "a@x.com",
      startAt: "2026-09-25T17:00:00Z",
    };
    expect(
      firstCallOutcome(booking, [row("2026-09-25", null)], "2026-09-25"),
    ).toBe("pending");
    expect(
      firstCallOutcome(booking, [row("2026-09-25", null)], "2026-09-30"),
    ).toBe("unlogged");
  });
});

describe("compareShowUp", () => {
  const person = (over: Partial<Parameters<typeof compareShowUp>[0][0]>) => ({
    hasSession: true,
    canceled: false,
    videosStarted: 1,
    firstCall: "held" as const,
    ...over,
  });

  it("splits logged first calls by whether they opened a video", () => {
    expect(
      compareShowUp(
        [
          person({}),
          person({ firstCall: "noShow" }),
          person({ videosStarted: 0, firstCall: "noShow" }),
        ],
        true,
      ),
    ).toEqual({
      connected: true,
      watched: { held: 1, noShow: 1 },
      watchedNothing: { held: 0, noShow: 1 },
    });
  });

  it("leaves out anyone we could not see, canceled calls and unanswered ones", () => {
    const result = compareShowUp(
      [
        person({ hasSession: false, videosStarted: 0 }),
        person({ canceled: true }),
        person({ firstCall: "pending" }),
        person({ firstCall: "unlogged" }),
        person({ firstCall: "notFirstCall" }),
      ],
      true,
    );
    expect(result.watched).toEqual({ held: 0, noShow: 0 });
    expect(result.watchedNothing).toEqual({ held: 0, noShow: 0 });
  });
});
