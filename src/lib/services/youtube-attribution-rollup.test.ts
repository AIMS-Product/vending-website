import { describe, expect, it } from "vitest";
import { indexShows } from "@/lib/services/funnel-monthly";
import {
  buildYouTubeAttribution,
  firstTouchAt,
  isYouTubeLead,
  type YouTubeLeadRow,
} from "@/lib/services/youtube-attribution-rollup";

function lead(overrides: Partial<YouTubeLeadRow> = {}): YouTubeLeadRow {
  return {
    id: crypto.randomUUID(),
    created_at: "2026-08-10T12:00:00.000Z",
    email: "lead@example.com",
    utm_source: "youtube",
    utm_campaign: "how-much-vending",
    utm_content: "desc-link-1",
    lifecycle_status: "qualified",
    call_booked_at: null,
    call_outcome: null,
    closed_won_at: null,
    closed_won_source: null,
    metadata: {},
    ...overrides,
  };
}

function build(
  leads: YouTubeLeadRow[],
  options: {
    clicksConnected?: boolean;
    visitsConnected?: boolean;
    outcomesConnected?: boolean;
    videos?: Parameters<typeof buildYouTubeAttribution>[0]["videos"];
    clicks?: Parameters<typeof buildYouTubeAttribution>[0]["clicks"];
    pageViews?: Parameters<typeof buildYouTubeAttribution>[0]["pageViews"];
    shows?: Parameters<typeof buildYouTubeAttribution>[0]["shows"];
  } = {},
) {
  return buildYouTubeAttribution({
    leads,
    videos: options.videos ?? [],
    clicks: options.clicks ?? [],
    pageViews: options.pageViews ?? [],
    clicksConnected: options.clicksConnected ?? true,
    visitsConnected: options.visitsConnected ?? true,
    outcomesConnected: options.outcomesConnected ?? true,
    shows: options.shows,
  });
}

describe("isYouTubeLead", () => {
  it("accepts every YouTube tag variant and rejects other channels", () => {
    expect(isYouTubeLead(lead({ utm_source: "youtube" }))).toBe(true);
    expect(isYouTubeLead(lead({ utm_source: "yt" }))).toBe(true);
    expect(isYouTubeLead(lead({ utm_source: "mike-yt" }))).toBe(true);
    expect(isYouTubeLead(lead({ utm_source: "YouTube" }))).toBe(true);
    expect(isYouTubeLead(lead({ utm_source: "google" }))).toBe(false);
    expect(isYouTubeLead(lead({ utm_source: null }))).toBe(false);
  });
});

describe("unmeasured stages", () => {
  it("reports null, never zero, for a stage with no data source", () => {
    const result = build([lead()], {
      clicksConnected: false,
      visitsConnected: false,
      outcomesConnected: false,
    });

    expect(result.totals.clicks).toBeNull();
    expect(result.totals.visits).toBeNull();
    expect(result.totals.attended).toBeNull();
    expect(result.totals.closed).toBeNull();
    expect(result.totals.leads).toBe(1);

    const [video] = result.videos;
    expect(video?.clicks).toBeNull();
    expect(video?.visits).toBeNull();
    expect(video?.closed).toBeNull();
    expect(video?.visitToLeadPct).toBeNull();
  });

  it("distinguishes a connected zero from an unmeasured stage", () => {
    const connected = build([lead()], { clicksConnected: true });
    expect(connected.totals.clicks).toBe(0);
  });

  it("gives a video 0 clicks only when it has a link the sync reads", () => {
    const video = (utm_campaign: string, bitly_id: string | null) => ({
      utm_campaign,
      title: utm_campaign,
      video_url: null,
      published_at: null,
      bitly_id,
      in_description: true,
    });
    const result = build(
      [lead({ utm_campaign: "linked" }), lead({ utm_campaign: "unlinked" })],
      {
        clicksConnected: true,
        videos: [
          video("linked", "booking.vendingpreneurs.com/yt-1"),
          video("unlinked", null),
        ],
      },
    );

    const byCampaign = new Map(
      result.videos.map((row) => [row.utmCampaign, row.clicks]),
    );
    expect(byCampaign.get("linked")).toBe(0);
    // No short link, so nothing could have counted a click: unknown, not 0.
    expect(byCampaign.get("unlinked")).toBeNull();
  });
});

describe("per-video rows", () => {
  it("names the video from the registry and flags slugs that are missing", () => {
    const result = build(
      [
        lead({ utm_campaign: "how-much-vending" }),
        lead({ utm_campaign: "orphan-slug" }),
      ],
      {
        videos: [
          {
            utm_campaign: "how-much-vending",
            title: "How Much Do Vending Machines ACTUALLY Make?",
            video_url: "https://youtu.be/GBXUhoV_Jvo",
            published_at: "2024-12-14",
            bitly_id: "booking.vendingpreneurs.com/yt-1",
            in_description: true,
          },
        ],
      },
    );

    const matched = result.videos.find(
      (row) => row.utmCampaign === "how-much-vending",
    );
    const orphan = result.videos.find(
      (row) => row.utmCampaign === "orphan-slug",
    );

    expect(matched?.title).toBe("How Much Do Vending Machines ACTUALLY Make?");
    expect(matched?.inRegistry).toBe(true);
    // An unmatched slug must show as itself rather than borrow a similar title.
    expect(orphan?.title).toBe("orphan-slug");
    expect(orphan?.inRegistry).toBe(false);
    expect(result.coverage.campaignsMissingFromRegistry).toEqual([
      "orphan-slug",
    ]);
  });

  it("does not list leads with no campaign as a slug missing from the registry", () => {
    const result = build([lead({ utm_campaign: null })]);

    expect(result.videos[0]?.utmCampaign).toBe("(untagged)");
    expect(result.coverage.campaignsMissingFromRegistry).toEqual([]);
  });

  it("sums clicks and visits onto the right campaign", () => {
    const result = build([lead({ utm_campaign: "a" })], {
      clicks: [
        { utm_campaign: "a", day: "2026-08-01", clicks: 30 },
        { utm_campaign: "a", day: "2026-08-02", clicks: 12 },
        { utm_campaign: "b", day: "2026-08-02", clicks: 99 },
      ],
      pageViews: [
        {
          utm_source: "youtube",
          utm_campaign: "a",
          occurred_at: "2026-08-01T00:00:00.000Z",
        },
        {
          utm_source: "youtube",
          utm_campaign: "a",
          occurred_at: "2026-08-02T00:00:00.000Z",
        },
      ],
    });

    const row = result.videos[0];
    expect(row?.clicks).toBe(42);
    expect(row?.visits).toBe(2);
    expect(row?.visitToLeadPct).toBe(50);
    // Campaign "b" has clicks but no leads, so it is not a funnel row here.
    expect(result.videos).toHaveLength(1);
    expect(result.totals.clicks).toBe(141);
  });
});

describe("attended", () => {
  const mirror = (email: string, showUp: string | null) => ({
    email,
    first_sales_call_booked_date: "2026-08-12",
    first_call_show_up: showUp,
  });
  const shows = {
    byEmail: indexShows([
      mirror("held@example.com", "Yes"),
      mirror("noshow@example.com", "No"),
      mirror("unlogged@example.com", null),
    ]),
    today: "2026-09-22",
  };

  it("counts only calls a rep logged as held in Close", () => {
    const result = build(
      [
        lead({ email: "held@example.com", call_booked_at: "2026-08-11" }),
        lead({ email: "noshow@example.com", call_booked_at: "2026-08-11" }),
        // No outcome logged anywhere: not assumed to have happened.
        lead({ email: "unlogged@example.com", call_booked_at: "2026-08-11" }),
        lead({ email: "missing@example.com", call_booked_at: "2026-08-11" }),
        lead({ email: "held@example.com", call_booked_at: null }),
      ],
      { shows },
    );

    expect(result.totals.booked).toBe(4);
    expect(result.totals.attended).toBe(1);
  });

  it("gives no share when sales outnumber logged shows", () => {
    const result = build(
      [
        lead({
          email: "unlogged@example.com",
          call_booked_at: "2026-08-11",
          call_outcome: "won",
        }),
      ],
      { shows },
    );
    const closed = result.stages.find(
      (stage) => stage.label === "Closed / won",
    );
    expect(result.totals.attended).toBe(0);
    expect(closed?.count).toBe(1);
    expect(closed?.ofPreviousPct).toBeNull();
  });

  it("reads as not observed when the Close mirror could not be read", () => {
    const result = build([
      lead({ email: "held@example.com", call_booked_at: "2026-08-11" }),
    ]);
    expect(result.totals.attended).toBeNull();
  });
});

describe("time to close", () => {
  it("counts only Close opportunity dates and reports the rest as undated", () => {
    const result = build([
      lead({
        created_at: "2026-08-01T00:00:00.000Z",
        closed_won_at: "2026-08-06",
        closed_won_source: "close_opportunity",
      }),
      lead({
        created_at: "2026-08-01T00:00:00.000Z",
        closed_won_at: "2026-08-20",
        closed_won_source: "close_opportunity",
      }),
      // Won, but the date is only the day we noticed the label flip.
      lead({
        created_at: "2026-08-01T00:00:00.000Z",
        closed_won_at: "2026-09-10",
        closed_won_source: "status_observed",
      }),
      // Won per Close's label with no date at all.
      lead({ call_outcome: "won" }),
    ]);

    expect(result.totals.closed).toBe(4);
    expect(result.timeToClose.measured).toBe(2);
    expect(result.timeToClose.undated).toBe(2);
    expect(result.timeToClose.medianDays).toBe(12);
    expect(result.timeToClose.longCycleCount).toBe(1);
    expect(
      result.timeToClose.buckets.find((b) => b.label === "0-7 days")?.count,
    ).toBe(1);
    expect(
      result.timeToClose.buckets.find((b) => b.label === "15-21 days")?.count,
    ).toBe(1);
  });

  it("drops a close date that predates the first touch instead of calling it zero days", () => {
    const result = build([
      lead({
        created_at: "2026-08-20T00:00:00.000Z",
        closed_won_at: "2026-08-01",
        closed_won_source: "close_opportunity",
      }),
    ]);

    expect(result.timeToClose.measured).toBe(0);
    expect(result.timeToClose.medianDays).toBeNull();
  });

  it("keeps a same-day close whose first touch is an afternoon instant", () => {
    // closed_won_at is a Postgres `date`, so comparing it as an instant made an
    // afternoon first touch land at -0.75 days and get dropped as negative.
    const result = build([
      lead({
        created_at: "2026-08-01T18:00:00.000Z",
        closed_won_at: "2026-08-01",
        closed_won_source: "close_opportunity",
      }),
    ]);

    expect(result.timeToClose.measured).toBe(1);
    expect(result.timeToClose.medianDays).toBe(0);
    expect(result.timeToClose.undated).toBe(0);
    expect(
      result.timeToClose.buckets.find((b) => b.label === "0-7 days")?.count,
    ).toBe(1);
  });

  it("counts a 14-day cycle as 14 days regardless of the time of day", () => {
    const result = build([
      lead({
        created_at: "2026-08-01T18:00:00.000Z",
        closed_won_at: "2026-08-15",
        closed_won_source: "close_opportunity",
      }),
    ]);

    expect(result.timeToClose.avgDays).toBe(14);
    expect(result.timeToClose.longCycleCount).toBe(1);
  });

  it("reports an unparseable won date as undated rather than as a same-day close", () => {
    const result = build([
      lead({
        created_at: "2026-08-01T18:00:00.000Z",
        closed_won_at: "not a date",
        closed_won_source: "close_opportunity",
      }),
    ]);

    expect(result.timeToClose.measured).toBe(0);
    expect(result.timeToClose.undated).toBe(1);
  });

  it("measures from first touch, not from the form fill", () => {
    const result = build([
      lead({
        created_at: "2026-08-20T00:00:00.000Z",
        metadata: {
          attribution_session: { first_touch_at: "2026-08-01T00:00:00.000Z" },
        },
        closed_won_at: "2026-08-25",
        closed_won_source: "close_opportunity",
      }),
    ]);

    // 24 days from the first touch, not 5 from the submission.
    expect(result.timeToClose.avgDays).toBe(24);
  });
});

describe("cohorts", () => {
  it("credits a lead to its first-touch month, not the month it submitted", () => {
    const result = build([
      lead({
        created_at: "2026-09-02T00:00:00.000Z",
        metadata: {
          attribution_session: { first_touch_at: "2026-08-28T00:00:00.000Z" },
        },
        closed_won_at: "2026-09-15",
        closed_won_source: "close_opportunity",
        call_booked_at: "2026-09-03",
      }),
      lead({ created_at: "2026-09-05T00:00:00.000Z" }),
    ]);

    const august = result.cohorts.find((row) => row.month === "2026-08");
    const september = result.cohorts.find((row) => row.month === "2026-09");

    expect(august?.leads).toBe(1);
    expect(august?.booked).toBe(1);
    // Touched in August, closed in September — August gets the credit.
    expect(august?.closedOtherMonth).toBe(1);
    expect(august?.closedSameMonth).toBe(0);
    expect(september?.leads).toBe(1);
  });
});

describe("cohort wins dated before the cohort", () => {
  it("still lands in a column, so the two columns add up to the wins", () => {
    // Close already held this lead: the win predates its first touch here.
    const result = build([
      lead({
        created_at: "2026-09-02T00:00:00.000Z",
        closed_won_at: "2026-08-20",
        closed_won_source: "close_opportunity",
        call_booked_at: "2026-08-10",
      }),
    ]);

    const september = result.cohorts.find((row) => row.month === "2026-09");
    expect(september?.closed).toBe(1);
    expect(september?.closedSameMonth).toBe(0);
    expect(september?.closedOtherMonth).toBe(1);
  });
});

describe("firstTouchAt", () => {
  it("falls back to row creation when the session never recorded one", () => {
    expect(firstTouchAt(lead({ metadata: null }))).toBe(
      "2026-08-10T12:00:00.000Z",
    );
    expect(firstTouchAt(lead({ metadata: { attribution_session: {} } }))).toBe(
      "2026-08-10T12:00:00.000Z",
    );
  });
});

describe("landing page visits", () => {
  it("counts only YouTube-tagged visits, not every tagged channel", () => {
    const result = build([lead({ utm_campaign: "how-much-vending" })], {
      pageViews: [
        {
          utm_source: "youtube",
          utm_campaign: "how-much-vending",
          occurred_at: "2026-08-10T12:00:00.000Z",
        },
        {
          utm_source: "yt",
          utm_campaign: "how-much-vending",
          occurred_at: "2026-08-10T13:00:00.000Z",
        },
        // Meta, Google and Instagram traffic is tagged too and lands in the
        // same table -- it must not inflate the YouTube funnel.
        {
          utm_source: "meta",
          utm_campaign: "retargeting-aug",
          occurred_at: "2026-08-10T12:00:00.000Z",
        },
        {
          utm_source: "instagram",
          utm_campaign: "how-much-vending",
          occurred_at: "2026-08-10T12:00:00.000Z",
        },
        {
          utm_source: null,
          utm_campaign: "how-much-vending",
          occurred_at: "2026-08-10T12:00:00.000Z",
        },
      ],
    });

    expect(result.totals.visits).toBe(2);
    expect(result.videos[0].visits).toBe(2);
  });
});

describe("visits from GA4 aggregates", () => {
  it("counts a pre-aggregated row by its view count, not as one visit", () => {
    const result = build([lead({ utm_campaign: "how-much-vending" })], {
      pageViews: [
        {
          utm_source: "youtube",
          utm_campaign: "how-much-vending",
          occurred_at: "2026-08-10T00:00:00.000Z",
          views: 403,
        },
        {
          utm_source: "youtube",
          utm_campaign: "how-much-vending",
          occurred_at: "2026-08-11T00:00:00.000Z",
          views: 166,
        },
        // Another channel's aggregate must stay out of the YouTube funnel.
        {
          utm_source: "meta",
          utm_campaign: "how-much-vending",
          occurred_at: "2026-08-11T00:00:00.000Z",
          views: 5000,
        },
      ],
    });

    expect(result.totals.visits).toBe(569);
    expect(result.videos[0].visits).toBe(569);
  });

  it("still treats a row with no count as a single visit", () => {
    // lead_page_views rows are one row per visit and carry no count.
    const result = build([lead({ utm_campaign: "a" })], {
      pageViews: [
        {
          utm_source: "youtube",
          utm_campaign: "a",
          occurred_at: "2026-08-10T00:00:00.000Z",
        },
        {
          utm_source: "youtube",
          utm_campaign: "a",
          occurred_at: "2026-08-11T00:00:00.000Z",
        },
      ],
    });

    expect(result.totals.visits).toBe(2);
  });
});

describe("coverage", () => {
  it("counts bookings that predate the lead as returning leads", () => {
    const result = build([
      lead({
        created_at: "2026-08-10T00:00:00.000Z",
        call_booked_at: "2026-08-01",
      }),
      lead({
        created_at: "2026-08-10T00:00:00.000Z",
        call_booked_at: "2026-08-12",
      }),
    ]);

    expect(result.coverage.bookedBeforeLead).toBe(1);
  });

  it("does not call a same-day booking a returning lead", () => {
    // call_booked_at is a `date`; an afternoon created_at computed as -1 day
    // and every same-day booking was counted as "booked before they applied".
    const result = build([
      lead({
        created_at: "2026-08-10T18:00:00.000Z",
        call_booked_at: "2026-08-10",
      }),
      lead({
        created_at: "2026-08-10T23:30:00.000Z",
        call_booked_at: "2026-08-11",
      }),
    ]);

    expect(result.coverage.bookedBeforeLead).toBe(0);
  });

  it("uses first touch, not row creation, to decide a lead is returning", () => {
    const result = build([
      lead({
        created_at: "2026-08-10T00:00:00.000Z",
        metadata: {
          attribution_session: { first_touch_at: "2026-07-28T09:00:00.000Z" },
        },
        call_booked_at: "2026-08-01",
      }),
    ]);

    // Booked after the first touch, so this is not a returning lead.
    expect(result.coverage.bookedBeforeLead).toBe(0);
  });

  it("does not count an unparseable booking date as a returning lead", () => {
    const result = build([
      lead({
        created_at: "2026-08-10T00:00:00.000Z",
        call_booked_at: "not a date",
      }),
    ]);

    expect(result.coverage.bookedBeforeLead).toBe(0);
  });
});
