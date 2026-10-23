import { beforeEach, describe, expect, it, vi } from "vitest";
import { signCalendarToken } from "@/lib/masterclass-session";
import { GET } from "./route";

const SECRET = "c".repeat(32);
const JOIN = "https://us06web.zoom.us/w/82284428904?tk=abc";
const mocks = vi.hoisted(() => ({
  getMasterclassEvent: vi.fn(),
  readJoinUrl: vi.fn(),
  config: {} as Record<string, string | undefined>,
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/masterclass-event", () => ({
  getMasterclassEvent: mocks.getMasterclassEvent,
}));
vi.mock("@/lib/masterclass-join-link", () => ({
  readJoinUrl: mocks.readJoinUrl,
}));

const start = new Date(Date.now() + 2 * 86_400_000);
const get = (token: string) =>
  GET(
    new Request(`https://www.vendingpreneurs.com/masterclass/join/${token}`),
    {
      params: Promise.resolve({ token }),
    },
  );
const location = (r: Response) => r.headers.get("location");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.MASTERCLASS_CAL_SECRET = SECRET;
  mocks.getMasterclassEvent.mockResolvedValue({
    startsAt: start.toISOString(),
  });
});

describe("GET /masterclass/join/<token>", () => {
  const token = () => signCalendarToken("abc123", start, SECRET)!;

  it("sends the registrant to their own Zoom link, privately", async () => {
    mocks.readJoinUrl.mockResolvedValue(JOIN);
    const r = await get(token());
    expect(r.status).toBe(302);
    expect(location(r)).toBe(JOIN);
    expect(r.headers.get("cache-control")).toBe("no-store, private");
    expect(mocks.readJoinUrl).toHaveBeenCalledWith(
      "abc123",
      start.toISOString(),
      "masterclass_join",
    );
  });

  it("falls back to the confirmed page while the link is not on the contact yet", async () => {
    mocks.readJoinUrl.mockResolvedValue(null);
    expect(location(await get(token()))).toBe(
      "https://www.vendingpreneurs.com/masterclass-confirmed",
    );
  });

  it("refuses tampered tokens and an earlier room's token without reading GHL", async () => {
    const t = token();
    expect(location(await get(`${t.slice(0, -1)}x`))).toBe(
      "https://www.vendingpreneurs.com/masterclass",
    );
    const old = signCalendarToken(
      "abc123",
      new Date(start.getTime() - 7 * 86_400_000),
      SECRET,
    )!;
    expect(location(await get(old))).toBe(
      "https://www.vendingpreneurs.com/masterclass",
    );
    mocks.getMasterclassEvent.mockResolvedValue({ startsAt: null });
    expect(location(await get(t))).toBe(
      "https://www.vendingpreneurs.com/masterclass",
    );
    expect(mocks.readJoinUrl).not.toHaveBeenCalled();
  });
});
