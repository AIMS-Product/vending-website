import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  createAdminClient: vi.fn(),
  readAllPages: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/services/paged-read", () => ({
  readAllPages: mocks.readAllPages,
}));

const {
  isCalendlyInviteeUri,
  recordBookingSession,
  loadBookingLinks,
  NO_BOOKING_LINKS,
} = await import("./calendly-booking-sessions");

const INVITEE =
  "https://api.calendly.com/scheduled_events/ABC-123/invitees/DEF-456";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.createAdminClient.mockReturnValue({
    from: (table: string) => {
      expect(table).toBe("calendly_booking_sessions");
      return { upsert: mocks.upsert };
    },
  });
});

describe("isCalendlyInviteeUri", () => {
  it("accepts only Calendly's own invitee resource", () => {
    expect(isCalendlyInviteeUri(INVITEE)).toBe(true);
  });

  it.each([
    ["a different host", INVITEE.replace("api.calendly.com", "evil.example")],
    ["http instead of https", INVITEE.replace("https", "http")],
    [
      "a scheduled event with no invitee",
      "https://api.calendly.com/scheduled_events/ABC",
    ],
    ["a trailing path", `${INVITEE}/extra`],
    ["a query string", `${INVITEE}?x=1`],
    [
      "a host suffix trick",
      "https://api.calendly.com.evil.example/scheduled_events/a/invitees/b",
    ],
    ["an id over 64 characters", INVITEE.replace("ABC-123", "a".repeat(65))],
    [
      "an id with a slash",
      "https://api.calendly.com/scheduled_events/a/b/invitees/c",
    ],
    ["an empty string", ""],
  ])("rejects %s", (_label, value) => {
    expect(isCalendlyInviteeUri(value)).toBe(false);
  });
});

describe("recordBookingSession", () => {
  it("writes the pair first-write-wins, keyed on the invitee", async () => {
    await recordBookingSession({
      vpSessionId: "  vp-session-1  ",
      inviteeUri: ` ${INVITEE} `,
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      { invitee_uri: INVITEE, vp_session_id: "vp-session-1" },
      { onConflict: "invitee_uri", ignoreDuplicates: true },
    );
  });

  it.each([
    ["a blank session", "   ", INVITEE],
    ["a session over 160 characters", "s".repeat(161), INVITEE],
    ["a URI that is not an invitee", "vp-session-1", "https://example.com/x"],
  ])("writes nothing for %s", async (_label, vpSessionId, inviteeUri) => {
    await recordBookingSession({ vpSessionId, inviteeUri });

    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("accepts a session of exactly 160 characters", async () => {
    await recordBookingSession({
      vpSessionId: "s".repeat(160),
      inviteeUri: INVITEE,
    });

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("never throws into the visitor's request, even when the client cannot be built", async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("Supabase config missing");
    });

    await expect(
      recordBookingSession({
        vpSessionId: "vp-session-1",
        inviteeUri: INVITEE,
      }),
    ).resolves.toBeUndefined();
  });

  it("never throws when the write itself rejects", async () => {
    mocks.upsert.mockRejectedValue(new Error("network"));

    await expect(
      recordBookingSession({
        vpSessionId: "vp-session-1",
        inviteeUri: INVITEE,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("loadBookingLinks", () => {
  it("indexes the table both ways round", async () => {
    mocks.readAllPages.mockResolvedValue({
      rows: [
        { invitee_uri: "inv-1", vp_session_id: "sess-a" },
        { invitee_uri: "inv-2", vp_session_id: "sess-a" },
        { invitee_uri: "inv-3", vp_session_id: "sess-b" },
      ],
      error: null,
    });

    const links = await loadBookingLinks();

    expect(links?.sessionByInvitee.get("inv-2")).toBe("sess-a");
    expect(links?.inviteesBySession.get("sess-a")).toEqual(["inv-1", "inv-2"]);
    expect(links?.inviteesBySession.get("sess-b")).toEqual(["inv-3"]);
  });

  it("treats a table that does not exist yet as empty, not as an outage", async () => {
    mocks.readAllPages.mockResolvedValue({
      rows: [],
      error: { code: "PGRST205", message: "no such table" },
    });

    await expect(loadBookingLinks()).resolves.toBe(NO_BOOKING_LINKS);
  });

  it("returns null on any other read error, so the page says links are missing", async () => {
    mocks.readAllPages.mockResolvedValue({
      rows: [{ invitee_uri: "inv-1", vp_session_id: "sess-a" }],
      error: { code: "500", message: "boom" },
    });

    await expect(loadBookingLinks()).resolves.toBeNull();
  });

  it("returns null when the read throws", async () => {
    mocks.readAllPages.mockRejectedValue(new Error("network"));

    await expect(loadBookingLinks()).resolves.toBeNull();
  });

  it("passes the exact-count option straight to select and pages by invitee", async () => {
    mocks.readAllPages.mockResolvedValue({ rows: [], error: null });

    await loadBookingLinks();

    const query = mocks.readAllPages.mock.calls[0][0] as (
      from: number,
      to: number,
      count: "exact" | undefined,
    ) => unknown;
    const range = vi.fn().mockReturnValue("page");
    const order = vi.fn().mockReturnValue({ range });
    const select = vi.fn().mockReturnValue({ order });
    mocks.createAdminClient.mockReturnValue({ from: () => ({ select }) });

    expect(query(0, 999, "exact")).toBe("page");
    expect(select).toHaveBeenCalledWith("invitee_uri,vp_session_id", {
      count: "exact",
    });
    expect(order).toHaveBeenCalledWith("invitee_uri");
    expect(range).toHaveBeenCalledWith(0, 999);
  });
});
