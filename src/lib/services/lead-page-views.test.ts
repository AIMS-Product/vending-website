import { beforeEach, describe, expect, it, vi } from "vitest";

type UpsertResult = { error: { code: string; message: string } | null };

const upsert = vi.fn<
  (
    row: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<UpsertResult>
>(async () => ({ error: null }));
const from = vi.fn(() => ({ upsert }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

const { recordTaggedPageView } = await import("./lead-page-views");

const AT = new Date("2026-09-10T15:30:00.000Z");

beforeEach(() => {
  upsert.mockClear();
  from.mockClear();
  upsert.mockImplementation(async () => ({ error: null }));
});

describe("recordTaggedPageView", () => {
  it("stores a tagged view keyed for one-per-session-per-day dedupe", async () => {
    await recordTaggedPageView({
      path: "/booking-youtube",
      vpSessionId: "sess_1",
      utmSource: "youtube",
      utmCampaign: "how-much-vending",
      utmContent: "desc-link-1",
      occurredAt: AT,
    });

    expect(from).toHaveBeenCalledWith("lead_page_views");
    expect(upsert).toHaveBeenCalledWith(
      {
        path: "/booking-youtube",
        vp_session_id: "sess_1",
        utm_source: "youtube",
        utm_campaign: "how-much-vending",
        utm_content: "desc-link-1",
        occurred_on: "2026-09-10",
        occurred_at: AT.toISOString(),
      },
      {
        onConflict: "vp_session_id,path,occurred_on",
        ignoreDuplicates: true,
      },
    );
  });

  it("caps every stored string, not just path and session", async () => {
    // POST /api/attribution/events is public and its zod schema puts no length
    // bound on a property value, so the cap has to live here.
    const long = "x".repeat(500);
    await recordTaggedPageView({
      path: `/booking-youtube${long}`,
      vpSessionId: `sess_${long}`,
      utmSource: `youtube${long}`,
      utmCampaign: `how-much-vending${long}`,
      utmContent: `desc-link-1${long}`,
      occurredAt: AT,
    });

    const row = upsert.mock.calls[0]?.[0] as Record<string, string>;
    expect(row.path).toHaveLength(300);
    expect(row.vp_session_id).toHaveLength(160);
    expect(row.utm_source).toHaveLength(200);
    expect(row.utm_campaign).toHaveLength(200);
    expect(row.utm_content).toHaveLength(200);
  });

  it("ignores an untagged view — it cannot be attributed to a video", async () => {
    await recordTaggedPageView({
      path: "/booking-youtube",
      vpSessionId: "sess_1",
      utmCampaign: null,
    });
    await recordTaggedPageView({
      path: "/booking-youtube",
      vpSessionId: "sess_1",
      utmCampaign: "   ",
    });

    expect(from).not.toHaveBeenCalled();
  });

  it("ignores a view with no path or no session to dedupe on", async () => {
    await recordTaggedPageView({
      path: "",
      vpSessionId: "sess_1",
      utmCampaign: "a",
    });
    await recordTaggedPageView({
      path: "/x",
      vpSessionId: "  ",
      utmCampaign: "a",
    });

    expect(from).not.toHaveBeenCalled();
  });

  it("normalises blank optional tags to null instead of empty strings", async () => {
    await recordTaggedPageView({
      path: "  /booking-youtube  ",
      vpSessionId: "  sess_1  ",
      utmSource: "   ",
      utmCampaign: "a",
      utmContent: "",
      occurredAt: AT,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/booking-youtube",
        vp_session_id: "sess_1",
        utm_source: null,
        utm_content: null,
      }),
      expect.anything(),
    );
  });

  it("never throws when the table is missing or the write fails", async () => {
    upsert.mockImplementation(async () => {
      throw new Error("relation does not exist");
    });

    await expect(
      recordTaggedPageView({
        path: "/booking-youtube",
        vpSessionId: "sess_1",
        utmCampaign: "a",
      }),
    ).resolves.toBeUndefined();
  });

  it("swallows the { error } PostgREST actually returns for a missing table", async () => {
    // The thrown-error case above is not what a missing relation looks like:
    // supabase-js resolves and puts 42P01 in `error`. That is the shape this
    // best-effort writer has to absorb before the migration is applied.
    upsert.mockImplementation(async () => ({
      error: {
        code: "42P01",
        message: "relation lead_page_views does not exist",
      },
    }));

    await expect(
      recordTaggedPageView({
        path: "/booking-youtube",
        vpSessionId: "sess_1",
        utmCampaign: "a",
      }),
    ).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledOnce();
  });
});
