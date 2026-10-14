import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signCalendarToken } from "@/lib/masterclass-session";
import { GET, JOIN_RETRY_MS } from "./route";

const SECRET = "c".repeat(32);
const JOIN = "https://us06web.zoom.us/w/82284428904?tk=abc";

const mocks = vi.hoisted(() => ({
  getMasterclassEvent: vi.fn(),
  readContactField: vi.fn(),
  checkPublicRateLimit: vi.fn(),
  config: {} as Record<string, string | undefined>,
}));
vi.mock("@/lib/config", () => ({
  config: mocks.config,
  publicConfig: { siteUrl: "https://www.vendingpreneurs.com" },
}));
vi.mock("@/lib/services/masterclass-event", () => ({
  getMasterclassEvent: mocks.getMasterclassEvent,
}));
vi.mock("@/lib/public-rate-limit", () => ({
  checkPublicRateLimit: mocks.checkPublicRateLimit,
}));
vi.mock("@/lib/ghl/webinar-registration", () => ({
  readContactField: mocks.readContactField,
}));

const upcoming = () => new Date(Date.now() + 2 * 86_400_000);
let start: Date;

const get = (token: string | null, to?: string) =>
  GET(
    new Request(
      `https://www.vendingpreneurs.com/masterclass/cal/${token}${to ? `?to=${to}` : ""}`,
    ),
    { params: Promise.resolve({ token: token ?? "" }) },
  );
const token = (contactId = "c1", at = start) =>
  signCalendarToken(contactId, at, SECRET) as string;

beforeEach(() => {
  vi.clearAllMocks();
  start = upcoming();
  Object.assign(mocks.config, {
    MASTERCLASS_CAL_SECRET: SECRET,
    GHL_WRITE_TOKEN: "pit-test",
  });
  mocks.getMasterclassEvent.mockResolvedValue({
    label: "October 20, 2026 at 7:30 PM CDT",
    startsAt: start.toISOString(),
    anthony: null,
  });
  mocks.readContactField.mockResolvedValue(JOIN);
  mocks.checkPublicRateLimit.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());

describe("GET /masterclass/cal/[token]", () => {
  it("serves an .ics whose location is the registrant's own link", async () => {
    const response = await get(token(), "ics");
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    const ics = (await response.text()).replace(/\r\n /g, "");
    expect(ics).toContain(`LOCATION:${JOIN}\r\n`);
    expect(ics).toMatch(/UID:masterclass-c1-\d+@vendingpreneurs\.com/);
    expect(mocks.readContactField).toHaveBeenCalledWith(
      "c1",
      "xoutue68ds9zlMLTkabO",
      {
        token: "pit-test",
      },
    );
  });

  it.each([
    ["google", "calendar.google.com"],
    ["outlook", "outlook.live.com"],
  ])(
    "sends %s the link as location, never to our own domain",
    async (to, host) => {
      const response = await get(token(), to);
      expect(response.status).toBe(302);
      const location = new URL(response.headers.get("Location") ?? "");
      expect(location.hostname).toBe(host);
      expect(location.searchParams.get("location")).toBe(JOIN);
    },
  );

  it.each([
    ["tampered", () => token().replace("c1", "c2")],
    [
      "signed with another secret",
      () => signCalendarToken("c1", start, "x".repeat(32)) as string,
    ],
    ["expired", () => token("c1", new Date(Date.now() - 2 * 86_400_000))],
    ["garbage", () => "not-a-token"],
  ])(
    "sends a %s token to the generic page without reading GHL",
    async (_l, make) => {
      const response = await get(make(), "google");
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "https://www.vendingpreneurs.com/masterclass",
      );
      expect(mocks.readContactField).not.toHaveBeenCalled();
    },
  );

  it("refuses a token minted for an earlier room once GHL holds the next one", async () => {
    const older = token(
      "c1",
      new Date(start.getTime() - 7 * 86_400_000 + 3_600_000),
    );
    const response = await get(older, "ics");
    expect(response.headers.get("Location")).toBe(
      "https://www.vendingpreneurs.com/masterclass",
    );
  });

  it("retries once after 3 s when the zap has not written the link yet", async () => {
    vi.useFakeTimers();
    mocks.readContactField
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JOIN);
    const pending = get(token(), "ics");
    await vi.advanceTimersByTimeAsync(JOIN_RETRY_MS);
    const ics = (await (await pending).text()).replace(/\r\n /g, "");
    expect(mocks.readContactField).toHaveBeenCalledTimes(2);
    expect(ics).toContain(`LOCATION:${JOIN}`);
  });

  it("falls back to the generic event when the link never arrives or is not Zoom's", async () => {
    vi.useFakeTimers();
    mocks.readContactField.mockResolvedValue("https://evil.example/w/1");
    const pending = get(token(), "ics");
    await vi.advanceTimersByTimeAsync(JOIN_RETRY_MS);
    const ics = await (await pending).text();
    expect(ics).toContain("LOCATION:Zoom (link in your confirmation email)");
    expect(ics).not.toContain("evil");
  });

  it("serves the generic event without reading GHL once a contact is over budget", async () => {
    mocks.checkPublicRateLimit.mockResolvedValue(false);
    const ics = await (await get(token(), "ics")).text();
    expect(ics).toContain("LOCATION:Zoom (link in your confirmation email)");
    expect(mocks.readContactField).not.toHaveBeenCalled();
    expect(mocks.checkPublicRateLimit).toHaveBeenCalledWith(
      "masterclass_cal",
      { ip: null, email: "contact:c1" },
      { failClosed: true },
    );
  });

  it("falls back to the generic event when GHL cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.readContactField.mockRejectedValue(new Error("GHL 500"));
    const ics = await (await get(token(), "ics")).text();
    expect(ics).toContain("LOCATION:Zoom (link in your confirmation email)");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
