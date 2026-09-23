import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("@/lib/config", () => ({ config: {} }));

import { daysBetween, runDataAudit, settledWindow } from "./data-audit-checks";

const now = new Date("2026-09-19T12:30:00.000Z");

/** Rows per table; every query returns that table's rows unfiltered. */
function fakeClient(rows: Record<string, Array<Record<string, unknown>>>) {
  const query = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of [
      "gte",
      "gt",
      "lte",
      "lt",
      "eq",
      "is",
      "not",
      "in",
      "order",
      "limit",
    ]) {
      chain[method] = () => chain;
    }
    chain.range = async () => ({ data: rows[table] ?? [], error: null });
    chain.select = (_columns: string, options?: { head?: boolean }) =>
      options?.head ? countable(rows[table] ?? []) : chain;
    // A plain `await` on the builder (the limit/order reads) resolves here.
    chain.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: rows[table] ?? [], error: null });
    return chain;
  };
  return {
    from: (table: string) => query(table),
  } as unknown as Pick<SupabaseClient<Database>, "from">;
}

function countable(rows: unknown[]) {
  const result = { count: rows.length, error: null };
  return {
    gte: () => countable(rows),
    gt: () => countable(rows),
    lte: () => countable(rows),
    lt: () => countable(rows),
    eq: () => countable(rows),
    is: () => countable(rows),
    not: () => countable(rows),
    in: () => countable(rows),
    order: () => countable(rows),
    range: () => countable(rows),
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
}

describe("settledWindow", () => {
  it("ends before the days a source is still restating", () => {
    expect(settledWindow(now, 2)).toMatchObject({
      from: "2026-09-11",
      to: "2026-09-17",
      exclusiveEnd: "2026-09-18",
    });
  });

  it("gives the exclusive end the live sources need", () => {
    expect(settledWindow(now, 1, 4)).toMatchObject({
      from: "2026-09-15",
      to: "2026-09-18",
      exclusiveEnd: "2026-09-19",
    });
  });
});

describe("daysBetween", () => {
  it("includes both ends", () => {
    expect(daysBetween("2026-09-17", "2026-09-19")).toEqual([
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
    ]);
  });
});

describe("spine-orphaned-bookings", () => {
  /** The shape the real defect had: a cohort's whole total re-landing on one day. */
  const link = (
    content: string,
    day: string,
    booked: number,
    synced: string,
  ) => ({
    day,
    source: "internal-webinar",
    medium: "during-night-of",
    campaign: "book_meeting",
    content,
    destination: "unknown",
    booked,
    synced_at: `${synced}T11:10:00.000Z`,
    leads: null,
  });

  const orphanRun = (channel_daily: Array<Record<string, unknown>>) =>
    runDataAudit({
      now,
      client: fakeClient({ channel_daily }),
      ga4: null,
      close: null,
      calendly: null,
      metricool: null,
      youtube: null,
      ghl: null,
    });

  it("counts a booking left on the day it moved off", async () => {
    const run = await orphanRun([
      // Where the cohort really sits, rewritten by the latest sync.
      link("aug11_end_cta", "2026-09-11", 13, "2026-09-19"),
      link("aug11_end_cta", "2026-09-12", 5, "2026-09-19"),
      // The same 18 again on a day the sync no longer writes them to.
      link("aug11_end_cta", "2026-09-18", 18, "2026-09-14"),
      // A live booking on that day, so the day itself was rewritten.
      link("sep18_end_cta", "2026-09-18", 2, "2026-09-19"),
    ]);
    const check = run.results.find(
      (result) => result.checkId === "spine-orphaned-bookings",
    )!;
    expect(check).toMatchObject({ status: "fail", ours: 18 });
    expect(check.detail).toContain("2026-09-18");
  });

  it("leaves a booking whose link survives nowhere else for a human", async () => {
    // The two standing rows in REPORTING.md section 9: stale, but there is no
    // other day to move them to, so the sync cannot clear them either.
    const run = await orphanRun([
      link("dead_session", "2026-09-18", 1, "2026-09-14"),
      link("sep18_end_cta", "2026-09-18", 2, "2026-09-19"),
    ]);
    expect(
      run.results.find(
        (result) => result.checkId === "spine-orphaned-bookings",
      ),
    ).toMatchObject({ status: "pass", ours: 0 });
  });

  it("does not call a whole day stale when one connector ran later", async () => {
    // Every booking row here was written by the same day's sync; the minutes
    // between connectors inside one cron are not staleness.
    const run = await orphanRun([
      { ...link("aug11_end_cta", "2026-09-11", 13, "2026-09-19") },
      {
        ...link("aug11_end_cta", "2026-09-12", 5, "2026-09-19"),
        synced_at: "2026-09-19T23:18:00.000Z",
      },
    ]);
    expect(
      run.results.find(
        (result) => result.checkId === "spine-orphaned-bookings",
      ),
    ).toMatchObject({ status: "pass", ours: 0 });
  });
});

describe("runDataAudit", () => {
  it("asks GoHighLevel past the window's last day and compares the keys the sync writes", async () => {
    const fetchFormSubmissions = vi.fn(async () => [
      { id: "a", formId: "f1", createdAt: "2026-09-16T10:00:00.000Z" },
      { id: "b", formId: "f1", createdAt: "2026-09-18T10:00:00.000Z" },
      // Outside the window: returned because endAt is exclusive, not counted.
      { id: "c", formId: "f1", createdAt: "2026-09-19T10:00:00.000Z" },
    ]);
    const run = await runDataAudit({
      now,
      client: fakeClient({
        channel_daily: [
          { day: "2026-09-16", leads: 1 },
          { day: "2026-09-18", leads: 1 },
        ],
      }),
      ga4: null,
      close: null,
      calendly: null,
      metricool: null,
      youtube: null,
      ghl: {
        listForms: async () => [{ id: "f1", name: "90 Day Checklist" }],
        fetchFormSubmissions,
        listWorkflows: async () => [],
        fetchWorkflowEmailStats: async () => ({
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
        }),
      },
    });

    expect(fetchFormSubmissions).toHaveBeenCalledWith({
      startAt: "2026-09-12",
      endAt: "2026-09-19",
    });
    const forms = run.results.find((result) => result.checkId === "ghl-forms")!;
    expect(forms).toMatchObject({ status: "pass", ours: 2, source: 2 });
  });

  it("never reports a source it could not reach as agreement", async () => {
    const run = await runDataAudit({
      now,
      client: fakeClient({}),
      ga4: null,
      close: null,
      calendly: null,
      metricool: null,
      youtube: null,
      ghl: null,
    });

    // Every check that needs an outside system says so; none of them passes.
    const configChecks = run.results.filter((result) =>
      result.checkId.endsWith("-config"),
    );
    expect(configChecks.map((result) => result.checkId).sort()).toEqual([
      "ad-spend-config",
      "calendly-config",
      "close-config",
      "ga4-config",
      "ghl-config",
      "youtube-config",
    ]);
    expect(configChecks.every((result) => result.status === "fail")).toBe(true);
    expect(run.summary.status).toBe("fail");
    // And a night where nothing ran is not a healthy night.
    expect(
      run.results.find((result) => result.checkId === "connector-health"),
    ).toMatchObject({ status: "fail" });
  });
});

describe("calendly-bookings", () => {
  // Calendly lists scheduled events; we store one row per invitee. The
  // onboarding call is a group event, so on 2026-09-22 three of them (2, 5 and
  // 2 invitees) put us 6 above Calendly on a week where no booking differed.
  it("compares calls, not the people invited to them", async () => {
    const onboarding = "https://api.calendly.com/scheduled_events/group";
    const run = await runDataAudit({
      now,
      client: fakeClient({
        calendly_bookings: [
          { scheduled_event_uri: onboarding },
          { scheduled_event_uri: onboarding },
          { scheduled_event_uri: onboarding },
          {
            scheduled_event_uri:
              "https://api.calendly.com/scheduled_events/one",
          },
        ],
      }),
      ga4: null,
      close: null,
      metricool: null,
      youtube: null,
      ghl: null,
      calendly: {
        getCurrentOrganizationUri: async () => "org",
        listScheduledEvents: async () => [
          { uri: onboarding, status: "active" },
          {
            uri: "https://api.calendly.com/scheduled_events/one",
            status: "active",
          },
        ],
      } as never,
    });
    expect(
      run.results.find((result) => result.checkId === "calendly-bookings"),
    ).toMatchObject({ status: "pass", ours: 2, source: 2 });
  });
});

describe("day-holes", () => {
  const holesRun = (youtube_video_daily: Array<Record<string, unknown>>) =>
    runDataAudit({
      now,
      client: fakeClient({ youtube_video_daily }),
      ga4: null,
      close: null,
      calendly: null,
      metricool: null,
      youtube: null,
      ghl: null,
    }).then((run) => run.results.find((r) => r.checkId === "day-holes")!);
  const views = (from: string, to: string, skip: string[] = []) =>
    daysBetween(from, to)
      .filter((day) => !skip.includes(day))
      .map((day) => ({ day, views: 4000 }));

  // YouTube Analytics reports about three days late. The check ended two days
  // back, so every night it called the newest day missing: 2026-09-19, then
  // 2026-09-20, each of which filled in by itself a day later.
  it("does not call a day missing that YouTube has not reported yet", async () => {
    const check = await holesRun(views("2026-09-04", "2026-09-16"));
    expect(check).toMatchObject({ status: "pass" });
  });

  it("still catches a real hole in YouTube views", async () => {
    const check = await holesRun(
      views("2026-09-04", "2026-09-16", ["2026-09-10"]),
    );
    expect(check).toMatchObject({ status: "fail" });
    expect(check.detail).toContain("YouTube views on 2026-09-10");
    expect(check.detail).not.toContain("2026-09-17");
  });
});

describe("spine orphans beyond bookings", () => {
  // `now` is 2026-09-19. Each sync ran cleanly this morning unless a test
  // says otherwise; the audit judges a row against its own sync's run.
  const ran = (
    connector: string,
    day = "2026-09-19",
    error: string | null = null,
  ) => ({
    connector,
    started_at: `${day}T11:10:00.000Z`,
    error,
  });
  const cleanRuns = [
    ran("metricool-ads"),
    ran("ga4-visits"),
    ran("leads"),
    ran("ghl-forms"),
    ran("metricool-posts"),
    ran("youtube-analytics"),
  ];
  const row = (
    key: Partial<Record<string, string>>,
    day: string,
    metrics: Record<string, number | null>,
    synced: string,
  ) => ({
    day,
    source: "website",
    medium: "form",
    campaign: "(not set)",
    content: "(not set)",
    destination: "unknown",
    ...key,
    ...metrics,
    synced_at: `${synced}T11:10:00.000Z`,
  });
  const audit = async (
    channel_daily: Array<Record<string, unknown>>,
    channel_sync_runs: Array<Record<string, unknown>> = cleanRuns,
  ) => {
    const run = await runDataAudit({
      now,
      client: fakeClient({ channel_daily, channel_sync_runs }),
      ga4: null,
      close: null,
      calendly: null,
      metricool: null,
      youtube: null,
      ghl: null,
    });
    return (id: string) => run.results.find((result) => result.checkId === id)!;
  };

  const meta = (content: string) => ({
    source: "meta_ads",
    medium: "paid",
    campaign: "120211",
    content,
  });

  it("catches spend left under a campaign's old name", async () => {
    const check = await audit([
      row(
        meta("Webinar Sep 22"),
        "2026-09-17",
        { spend: 698.43 },
        "2026-09-19",
      ),
      row(meta("Webinar Sep 15"), "2026-09-17", { spend: 462 }, "2026-09-18"),
    ]);
    expect(check("spine-orphaned-spend")).toMatchObject({
      status: "fail",
      ours: 462,
    });
    expect(check("spine-orphaned-spend").detail).toContain("Webinar Sep 15");
  });

  it("does not flag the old name once clearRenamedAdRows has blanked it", async () => {
    const check = await audit([
      row(
        meta("Webinar Sep 22"),
        "2026-09-17",
        { spend: 698.43 },
        "2026-09-19",
      ),
      row(meta("Webinar Sep 15"), "2026-09-17", { spend: null }, "2026-09-19"),
    ]);
    expect(check("spine-orphaned-spend")).toMatchObject({
      status: "pass",
      ours: 0,
    });
  });

  it("catches visits GA4 moved to another key and passes rewritten ones", async () => {
    const stale = await audit([
      row({ source: "google" }, "2026-09-18", { visits: 120 }, "2026-09-19"),
      row({ source: "(not set)" }, "2026-09-18", { visits: 40 }, "2026-09-18"),
    ]);
    expect(stale("spine-orphaned-visits")).toMatchObject({
      status: "fail",
      ours: 40,
    });

    const fresh = await audit([
      row({ source: "google" }, "2026-09-18", { visits: 120 }, "2026-09-19"),
      row({ source: "(not set)" }, "2026-09-18", { visits: 40 }, "2026-09-19"),
    ]);
    expect(fresh("spine-orphaned-visits")).toMatchObject({ status: "pass" });
  });

  it("leaves days older than the writer's own window alone", async () => {
    // GA4 re-reads three days; 09-10 is history, not an orphan.
    const check = await audit([
      row({ source: "google" }, "2026-09-10", { visits: 120 }, "2026-09-12"),
      row({ source: "(not set)" }, "2026-09-10", { visits: 40 }, "2026-09-10"),
    ]);
    expect(check("spine-orphaned-visits")).toMatchObject({
      status: "pass",
      ours: 0,
    });
  });

  it("warns on a site lead left on a key the leads sync stopped writing", async () => {
    const check = await audit([
      row({ campaign: "spring" }, "2026-08-20", { leads: 2 }, "2026-09-19"),
      row({ campaign: "sprnig" }, "2026-08-20", { leads: 1 }, "2026-09-02"),
    ]);
    expect(check("spine-orphaned-leads")).toMatchObject({
      status: "warn",
      ours: 1,
    });
  });

  it("judges leads writers sharing the column by their own runs", async () => {
    const check = await audit(
      [
        // Site leads, rewritten by this morning's leads run.
        row({}, "2026-09-17", { leads: 3 }, "2026-09-19"),
        // A GHL lead magnet, last written by the 09-17 run: every later
        // ghl-forms run failed, so it has nothing newer to be judged by.
        row(
          {
            source: "mike-ig",
            medium: "lead-magnet",
            content: "90-day-checklist",
          },
          "2026-09-17",
          { leads: 5 },
          "2026-09-17",
        ),
        // Webinar registrations, pushed a week ago and never re-sent.
        row(
          {
            source: "meta_ads",
            medium: "paid",
            campaign: "sep8",
            content: "warm",
            destination: "webinar-register",
          },
          "2026-09-17",
          { leads: 40 },
          "2026-09-12",
        ),
        // A post rewritten this morning, so the day's clicks were rewritten.
        row(
          { source: "instagram", medium: "organic", content: "18042" },
          "2026-09-17",
          { clicks: 4 },
          "2026-09-19",
        ),
        // ManyChat's one row a day, written when that day's event arrived.
        row(
          { source: "manychat", medium: "chat", campaign: "pearl" },
          "2026-09-17",
          { leads: 2, clicks: 1 },
          "2026-09-17",
        ),
      ],
      [
        ...cleanRuns.filter((run) => run.connector !== "ghl-forms"),
        ran("ghl-forms", "2026-09-17"),
        ran(
          "ghl-forms",
          "2026-09-19",
          "3 rows failed to write; see the server log.",
        ),
      ],
    );
    expect(check("spine-orphaned-leads")).toMatchObject({
      status: "pass",
      ours: 0,
    });
    expect(check("spine-orphaned-clicks")).toMatchObject({ status: "pass" });
  });

  it("does not blame the leads sync for a row another connector touched later", async () => {
    // GA4 bumped the first row's stamp this morning; the leads sync last ran
    // cleanly yesterday, so yesterday's stamp is as fresh as a lead row gets.
    const check = await audit(
      [
        row(
          { campaign: "spring" },
          "2026-09-10",
          { leads: 1, visits: 3 },
          "2026-09-19",
        ),
        row({ campaign: "summer" }, "2026-09-10", { leads: 1 }, "2026-09-18"),
      ],
      [
        ...cleanRuns.filter((run) => run.connector !== "leads"),
        ran("leads", "2026-09-18"),
        ran(
          "leads",
          "2026-09-19",
          "2 rows failed to write; see the server log.",
        ),
      ],
    );
    expect(check("spine-orphaned-leads")).toMatchObject({
      status: "pass",
      ours: 0,
    });
  });

  it("warns on post clicks under a key Metricool no longer writes", async () => {
    const check = await audit([
      row(
        { source: "mike-ig", medium: "organic", content: "18042" },
        "2026-09-05",
        { clicks: 9 },
        "2026-09-19",
      ),
      row(
        { source: "instagram", medium: "organic", content: "18042" },
        "2026-09-05",
        { clicks: 7 },
        "2026-09-11",
      ),
    ]);
    expect(check("spine-orphaned-clicks")).toMatchObject({
      status: "warn",
      ours: 7,
    });
  });

  it("warns on a win left behind with its lead", async () => {
    const check = await audit([
      row({ campaign: "spring" }, "2026-07-01", { won: 1 }, "2026-09-19"),
      row({ campaign: "sprnig" }, "2026-07-01", { won: 1 }, "2026-09-01"),
    ]);
    expect(check("spine-orphaned-won")).toMatchObject({
      status: "warn",
      ours: 1,
    });
  });

  it("says a sync with no clean run was not checked instead of passing it", async () => {
    const check = await audit(
      [row(meta("Webinar Sep 15"), "2026-09-17", { spend: 462 }, "2026-09-10")],
      [ran("metricool-ads", "2026-09-19", "skipped: not configured")],
    );
    expect(check("spine-orphaned-spend")).toMatchObject({ status: "skipped" });
    expect(check("spine-orphaned-spend").detail).toContain("metricool-ads");
  });
});
