import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE,
  verifyMasterclassSession,
} from "@/lib/masterclass-session";
import { registerForMasterclass } from "./actions";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  cookieSet: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
  checkPublicRateLimit: vi.fn(),
  registerWebinarContact: vi.fn(),
  getMasterclassEvent: vi.fn(),
  config: {
    GHL_WRITE_TOKEN: "pit-test" as string | undefined,
    MASTERCLASS_SESSION_SECRET: "k".repeat(32) as string | undefined,
  },
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/public-rate-limit", async () => ({
  ...(await vi.importActual<typeof import("@/lib/public-rate-limit")>(
    "@/lib/public-rate-limit",
  )),
  checkPublicRateLimit: mocks.checkPublicRateLimit,
}));
vi.mock("@/lib/ghl/webinar-registration", async () => ({
  ...(await vi.importActual<typeof import("@/lib/ghl/webinar-registration")>(
    "@/lib/ghl/webinar-registration",
  )),
  registerWebinarContact: mocks.registerWebinarContact,
}));
vi.mock("@/lib/services/masterclass-event", () => ({
  getMasterclassEvent: mocks.getMasterclassEvent,
}));

function form(overrides: Record<string, string | null> = {}) {
  const fields: Record<string, string | null> = {
    firstName: "Mary",
    lastName: "Berg",
    email: "Mary@Example.com",
    phone: "(541) 555-0123",
    smsConsent: "on",
    utm_source: "meta",
    utm_content: "120251367443830338",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.GHL_WRITE_TOKEN = "pit-test";
  mocks.config.MASTERCLASS_SESSION_SECRET = "k".repeat(32);
  mocks.headers.mockResolvedValue(new Headers({ "x-real-ip": "1.2.3.4" }));
  mocks.checkPublicRateLimit.mockResolvedValue(true);
  mocks.registerWebinarContact.mockResolvedValue({
    outcome: "registered",
    contactId: "c1",
  });
  mocks.getMasterclassEvent.mockResolvedValue({
    label: "October 6, 2026 at 7:30 PM CDT",
    startsAt: null,
    anthony: null,
  });
});

describe("registerForMasterclass", () => {
  it("registers through GHL with this room's tag, then confirms", async () => {
    await expect(registerForMasterclass({}, form())).rejects.toThrow(
      "REDIRECT /masterclass-confirmed?first=Mary",
    );
    expect(mocks.registerWebinarContact).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "mary@example.com",
        phone: "+15415550123",
        eventTag: "webinar-oct6",
        attribution: {
          utm_source: "meta",
          utm_content: "120251367443830338",
        },
      }),
      { token: "pit-test", locationId: "Qxw5m2PoOz2MCr6m2v0M" },
    );
  });

  it("requires SMS consent, like the GHL form", async () => {
    const state = await registerForMasterclass({}, form({ smsConsent: null }));
    expect(state.errors?.smsConsent).toBeTruthy();
    expect(mocks.registerWebinarContact).not.toHaveBeenCalled();
  });

  it("fails closed with a safe message when GHL refuses", async () => {
    mocks.registerWebinarContact.mockRejectedValue(new Error("GHL 500"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await registerForMasterclass({}, form());
    expect(state.errors?.form).toMatch(/could not save your seat/);
    expect(state.errors?.form).not.toMatch(/GHL|500/);
    expect(mocks.redirect).not.toHaveBeenCalled();
    // The log carries no email or phone.
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/mary|555/i);
    error.mockRestore();
  });

  it("refuses to register without a write token", async () => {
    mocks.config.GHL_WRITE_TOKEN = undefined;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const state = await registerForMasterclass({}, form());
    expect(state.errors?.form).toBeTruthy();
    expect(mocks.registerWebinarContact).not.toHaveBeenCalled();
  });

  it("stops at the rate limit", async () => {
    mocks.checkPublicRateLimit.mockResolvedValue(false);
    const state = await registerForMasterclass({}, form());
    expect(state.errors?.form).toBeTruthy();
    // Stops at the first refusal.
    expect(mocks.checkPublicRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.registerWebinarContact).not.toHaveBeenCalled();
  });

  it("checks a loose IP budget, then tight email and phone budgets, all fail closed", async () => {
    await expect(registerForMasterclass({}, form())).rejects.toThrow(
      "REDIRECT",
    );
    expect(mocks.checkPublicRateLimit.mock.calls).toEqual([
      [
        "masterclass_register_ip",
        { ip: "1.2.3.4", email: null },
        { failClosed: true },
      ],
      [
        "masterclass_register",
        { ip: null, email: "mary@example.com" },
        { failClosed: true },
      ],
      [
        "masterclass_register_phone",
        { ip: null, email: "phone:+15415550123" },
        { failClosed: true },
      ],
    ]);
  });

  it("gives each phone its own budget, fail closed", async () => {
    mocks.checkPublicRateLimit
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const state = await registerForMasterclass({}, form());
    expect(state.errors?.form).toBeTruthy();
    expect(mocks.checkPublicRateLimit).toHaveBeenLastCalledWith(
      "masterclass_register_phone",
      { ip: null, email: "phone:+15415550123" },
      { failClosed: true },
    );
    expect(mocks.registerWebinarContact).not.toHaveBeenCalled();
  });

  it.each([
    ["+44 20 7946 0958", "phone"],
    ["555-0123", "phone"],
    ["1 (041) 555-0123", "phone"],
  ])("refuses a non US/Canada phone %s", async (phone, field) => {
    const state = await registerForMasterclass({}, form({ phone }));
    expect(state.errors?.[field as "phone"]).toMatch(/US or Canada/);
    expect(mocks.registerWebinarContact).not.toHaveBeenCalled();
  });

  it("accepts a +1 number written with a country code", async () => {
    await expect(
      registerForMasterclass({}, form({ phone: "+1 541 555 0123" })),
    ).rejects.toThrow("REDIRECT");
    expect(mocks.registerWebinarContact.mock.calls[0][0].phone).toBe(
      "+15415550123",
    );
  });

  it.each([["www.evil.com"], ["http://x"], ["M@ry"], ["Mary2"]])(
    "keeps links out of a name that is texted back: %s",
    async (firstName) => {
      const state = await registerForMasterclass({}, form({ firstName }));
      expect(state.errors?.firstName).toBe("Use letters only");
      expect(mocks.registerWebinarContact).not.toHaveBeenCalled();
    },
  );

  it("accepts real names", async () => {
    await expect(
      registerForMasterclass(
        {},
        form({ firstName: "Mary-Jane", lastName: "O'Neil Núñez" }),
      ),
    ).rejects.toThrow("REDIRECT");
  });

  it("shows a last-name error instead of dropping it", async () => {
    const state = await registerForMasterclass({}, form({ lastName: "a.com" }));
    expect(state.errors?.lastName).toBeTruthy();
  });

  it("sends a honeypot bot to the thank-you page and writes nothing", async () => {
    await expect(
      registerForMasterclass({}, form({ company_website: "spam.example" })),
    ).rejects.toThrow("REDIRECT");
    expect(mocks.registerWebinarContact).not.toHaveBeenCalled();
    expect(mocks.checkPublicRateLimit).not.toHaveBeenCalled();
  });

  it("still registers when the event date cannot be read", async () => {
    mocks.getMasterclassEvent.mockResolvedValue({
      label: null,
      startsAt: null,
      anthony: null,
    });
    await expect(registerForMasterclass({}, form())).rejects.toThrow(
      "REDIRECT",
    );
    expect(mocks.registerWebinarContact.mock.calls[0][0].eventTag).toBeNull();
  });

  it.each(["registered", "already-registered"])(
    "sets a signed, short-lived session cookie for the contact (%s)",
    async (outcome) => {
      mocks.registerWebinarContact.mockResolvedValue({
        outcome,
        contactId: "c1",
      });
      await expect(registerForMasterclass({}, form())).rejects.toThrow(
        "REDIRECT",
      );
      expect(mocks.cookieSet).toHaveBeenCalledTimes(1);
      const [name, value, options] = mocks.cookieSet.mock.calls[0];
      expect(name).toBe(SESSION_COOKIE);
      expect(
        verifyMasterclassSession(
          value,
          mocks.config.MASTERCLASS_SESSION_SECRET,
        ),
      ).toBe("c1");
      expect(options).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/masterclass-confirmed",
        maxAge: 24 * 60 * 60,
      });
    },
  );

  it("registers exactly as before, with no cookie, when the secret is missing", async () => {
    mocks.config.MASTERCLASS_SESSION_SECRET = undefined;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(registerForMasterclass({}, form())).rejects.toThrow(
      "REDIRECT /masterclass-confirmed?first=Mary",
    );
    expect(mocks.registerWebinarContact).toHaveBeenCalledTimes(1);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sets no cookie when registration fails or for a honeypot bot", async () => {
    mocks.registerWebinarContact.mockRejectedValue(new Error("GHL 500"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await registerForMasterclass({}, form());
    await expect(
      registerForMasterclass({}, form({ company_website: "spam.example" })),
    ).rejects.toThrow("REDIRECT");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
