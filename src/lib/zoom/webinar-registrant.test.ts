import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isJoinLinkFor,
  pickWebinar,
  registerZoomRegistrant,
  resetZoomCache,
} from "./webinar-registrant";

const CREDS = { accountId: "acct", clientId: "id", clientSecret: "secret" };
const PERSON = {
  startsAt: "2026-10-21T00:30:00.000Z", // Oct 20, 7:30 PM CDT
  email: "mary@example.com",
  firstName: "Mary",
  lastName: "Berg",
};
const JOIN = "https://us06web.zoom.us/w/82284428904?tk=abc";

/** Scripted Zoom: token, upcoming list, registrant. Every call recorded. */
function zoom(
  over: {
    list?: unknown;
    registrant?: unknown;
    status?: Record<string, number>;
  } = {},
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const step = url.includes("/oauth/token")
      ? "token"
      : url.includes("/registrants")
        ? "register"
        : "list";
    const body =
      step === "token"
        ? { access_token: "tok", expires_in: 3600 }
        : step === "list"
          ? (over.list ?? {
              webinars: [
                { id: 82284428904, start_time: "2026-10-20T23:00:00Z" },
                { id: 1, start_time: "2026-10-28T00:30:00Z" },
              ],
            })
          : (over.registrant ?? { registrant_id: "r1", join_url: JOIN });
    return new Response(JSON.stringify(body), {
      status: over.status?.[step] ?? 201,
    });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

beforeEach(() => {
  resetZoomCache();
  vi.restoreAllMocks();
});

describe("pickWebinar", () => {
  const start = PERSON.startsAt;
  it("one webinar on the room's Central date -> its id, even at another hour", () => {
    expect(
      pickWebinar([{ id: 7, start_time: "2026-10-20T23:00:00Z" }], start),
    ).toBe(7);
  });
  it("none on that date -> null", () => {
    expect(
      pickWebinar([{ id: 7, start_time: "2026-10-27T23:00:00Z" }], start),
    ).toBeNull();
  });
  it("two on that date -> null, never a guess", () => {
    expect(
      pickWebinar(
        [
          { id: 7, start_time: "2026-10-20T23:00:00Z" },
          { id: 8, start_time: "2026-10-21T00:30:00Z" },
        ],
        start,
      ),
    ).toBeNull();
  });
});

describe("isJoinLinkFor", () => {
  it("accepts only an https zoom.us /w/<id> link", () => {
    expect(isJoinLinkFor(JOIN, 82284428904)).toBe(true);
    expect(isJoinLinkFor(JOIN, 1)).toBe(false);
    expect(
      isJoinLinkFor("https://evil.example/w/82284428904", 82284428904),
    ).toBe(false);
    expect(isJoinLinkFor("https://zoom.us.evil.example/w/1", 1)).toBe(false);
    expect(isJoinLinkFor("http://zoom.us/w/1", 1)).toBe(false);
    expect(isJoinLinkFor("not a url", 1)).toBe(false);
  });
});

describe("registerZoomRegistrant", () => {
  it("registers in the room's webinar and returns the personal link", async () => {
    const { calls, fetchImpl } = zoom();
    await expect(
      registerZoomRegistrant(PERSON, CREDS, { fetchImpl }),
    ).resolves.toBe(JOIN);
    expect(calls.map((c) => c.url.split("?")[0])).toEqual([
      "https://zoom.us/oauth/token",
      "https://api.zoom.us/v2/users/anthony%40vendingpreneurs.co/webinars",
      "https://api.zoom.us/v2/webinars/82284428904/registrants",
    ]);
    expect(JSON.parse(String(calls[2].init.body))).toEqual({
      email: "mary@example.com",
      first_name: "Mary",
      last_name: "Berg",
    });
  });

  it("reuses the token and webinar list within the cache window", async () => {
    const { calls, fetchImpl } = zoom();
    await registerZoomRegistrant(PERSON, CREDS, { fetchImpl });
    await registerZoomRegistrant(PERSON, CREDS, { fetchImpl });
    expect(calls.filter((c) => c.url.includes("/registrants"))).toHaveLength(2);
    expect(calls).toHaveLength(4);
  });

  it.each([
    ["the token is refused", { status: { token: 401 } }],
    ["the list fails", { status: { list: 500 } }],
    ["no webinar is on the room date", { list: { webinars: [] } }],
    ["registration is refused", { status: { register: 400 } }],
    ["the answer has no join link", { registrant: { registrant_id: "r1" } }],
    [
      "the link is for another webinar",
      { registrant: { join_url: "https://us06web.zoom.us/w/9?tk=x" } },
    ],
  ])("returns null and logs without PII when %s", async (_label, over) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchImpl } = zoom(over);
    await expect(
      registerZoomRegistrant(PERSON, CREDS, { fetchImpl }),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "[masterclass] zoom-skip",
      expect.any(Object),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/mary|berg|tk=/i);
  });

  it("returns null when the network throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(
      registerZoomRegistrant(PERSON, CREDS, { fetchImpl }),
    ).resolves.toBeNull();
  });
});
