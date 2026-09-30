import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  intakeCopy,
  MASTERCLASS_BUSY_MESSAGE,
} from "@/lib/content/masterclass";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  signMasterclassSession,
} from "@/lib/masterclass-session";
import { saveMasterclassIntake } from "./actions";

const SECRET = "k".repeat(32);

const mocks = vi.hoisted(() => ({
  cookie: vi.fn(),
  cookieSet: vi.fn(),
  checkPublicRateLimit: vi.fn(),
  config: {
    GHL_WRITE_TOKEN: "pit-test" as string | undefined,
    MASTERCLASS_SESSION_SECRET: undefined as string | undefined,
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookie, set: mocks.cookieSet }),
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/public-rate-limit", async () => ({
  ...(await vi.importActual<typeof import("@/lib/public-rate-limit")>(
    "@/lib/public-rate-limit",
  )),
  checkPublicRateLimit: mocks.checkPublicRateLimit,
}));

const fetchMock = vi.fn();

const ANSWERS = {
  situation:
    "I already have some kind of side hustle or small business, but it didn't work out",
  timeline: "Within 30 days",
  income: "More than $151,000",
};

function form(overrides: Partial<Record<keyof typeof ANSWERS, string>> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...ANSWERS, ...overrides })) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
    init.method === "GET"
      ? new Response(
          JSON.stringify({ contact: { id: "c1", customFields: [] } }),
        )
      : new Response("{}"),
  );
  mocks.config.GHL_WRITE_TOKEN = "pit-test";
  mocks.config.MASTERCLASS_SESSION_SECRET = SECRET;
  mocks.checkPublicRateLimit.mockResolvedValue(true);
  mocks.cookie.mockImplementation((name: string) =>
    name === SESSION_COOKIE
      ? { name, value: signMasterclassSession("c1", SECRET) }
      : undefined,
  );
});

describe("saveMasterclassIntake", () => {
  it("offers exactly the GHL picklist options", () => {
    expect(intakeCopy.questions.map((q) => q.options.length)).toEqual([
      4, 5, 5,
    ]);
  });

  it("writes only the three answers to the cookie's contact", async () => {
    const state = await saveMasterclassIntake({}, form());
    expect(state).toEqual({ saved: true, values: ANSWERS });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://services.leadconnectorhq.com/contacts/c1");
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer pit-test");
    const body = JSON.parse(init.body);
    // Never name, email, phone or tags.
    expect(Object.keys(body)).toEqual(["customFields"]);
    expect(body.customFields).toEqual([
      { id: "z2qJKdiM9l6y0X1K38eJ", field_value: ANSWERS.situation },
      { id: "UrA1On8ehTnSkzuS97Vu", field_value: "Within 30 days" },
      { id: "VxAS61ZmZ88O3txQ4Rr8", field_value: "More than $151,000" },
    ]);
    expect(mocks.checkPublicRateLimit).toHaveBeenCalledWith(
      "masterclass_intake",
      { ip: null, email: "contact:c1" },
      { failClosed: true },
    );
  });

  it.each([
    ["situation", "I am rich"],
    ["timeline", "right now"],
    ["income", ""],
  ] as const)("refuses an answer GHL does not offer (%s)", async (key, bad) => {
    const state = await saveMasterclassIntake({}, form({ [key]: bad }));
    expect(state.errors?.[key]).toBe(intakeCopy.required);
    expect(state.saved).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", () => undefined],
    [
      "tampered",
      () => ({ value: `c2${signMasterclassSession("c1", SECRET)!.slice(2)}` }),
    ],
    [
      "wrong secret",
      () => ({ value: signMasterclassSession("c1", "x".repeat(32)) }),
    ],
    [
      "expired",
      () => ({
        value: signMasterclassSession(
          "c1",
          SECRET,
          new Date(Date.now() - SESSION_TTL_MS - 1000),
        ),
      }),
    ],
  ])("refuses a %s cookie with a safe message", async (_label, cookie) => {
    mocks.cookie.mockImplementation(cookie);
    const state = await saveMasterclassIntake({}, form());
    expect(state.errors?.form).toBe(intakeCopy.expired);
    // Answers stay in the form.
    expect(state.values).toEqual(ANSWERS);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.checkPublicRateLimit).not.toHaveBeenCalled();
  });

  it("refuses when the secret is not configured", async () => {
    mocks.config.MASTERCLASS_SESSION_SECRET = undefined;
    const state = await saveMasterclassIntake({}, form());
    expect(state.errors?.form).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops at the rate limit", async () => {
    mocks.checkPublicRateLimit.mockResolvedValue(false);
    const state = await saveMasterclassIntake({}, form());
    // The limiter also refuses during an outage, so never "too many".
    expect(state.errors?.form).toBe(MASTERCLASS_BUSY_MESSAGE);
    expect(state.values).toEqual(ANSWERS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed with a safe message and no PII when GHL refuses", async () => {
    fetchMock.mockImplementation(
      async () => new Response("contact c1 not found", { status: 400 }),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await saveMasterclassIntake({}, form());
    expect(state.errors?.form).toBe(intakeCopy.failed);
    expect(state.saved).toBeUndefined();
    expect(state.values).toEqual(ANSWERS);
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/151|30 days|c1/);
    error.mockRestore();
  });

  it("refuses without a write token", async () => {
    mocks.config.GHL_WRITE_TOKEN = undefined;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await saveMasterclassIntake({}, form());
    expect(state.errors?.form).toBe(intakeCopy.failed);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expires the session after a save, so a reload hides the form", async () => {
    const value = signMasterclassSession("c1", SECRET);
    mocks.cookie.mockReturnValue({ value });
    await saveMasterclassIntake({}, form());
    // Re-set with maxAge 0, not deleted: the same-trip re-render keeps the thank-you.
    expect(mocks.cookieSet).toHaveBeenCalledWith(SESSION_COOKIE, value, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/masterclass-confirmed",
      maxAge: 0,
    });
  });

  it("never overwrites answers already on the contact, and still says thanks", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        contact: {
          id: "c1",
          customFields: [
            { id: "z2qJKdiM9l6y0X1K38eJ", value: "a" },
            { id: "UrA1On8ehTnSkzuS97Vu", value: "b" },
            { id: "VxAS61ZmZ88O3txQ4Rr8", value: "c" },
          ],
        },
      }),
    );
    const state = await saveMasterclassIntake({}, form());
    expect(state.saved).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("fails closed with the safe message when the contact cannot be read", async () => {
    fetchMock.mockImplementation(
      async () => new Response("not found", { status: 404 }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await saveMasterclassIntake({}, form());
    expect(state.errors?.form).toBe(intakeCopy.failed);
    expect(state.values).toEqual(ANSWERS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
