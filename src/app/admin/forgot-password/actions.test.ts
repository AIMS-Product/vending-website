import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestPasswordReset } from "./actions";

const mocks = vi.hoisted(() => {
  const sendPasswordSetupEmail = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    createAdminClient: vi.fn(() => ({ from })),
    headers: vi.fn(),
    checkPublicRateLimit: vi.fn(),
    sendPasswordSetupEmail,
    maybeSingle,
    eq,
    select,
    from,
  };
});

vi.mock("@/lib/supabase/password-email", () => ({
  sendPasswordSetupEmail: mocks.sendPasswordSetupEmail,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/public-rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/public-rate-limit")>()),
  checkPublicRateLimit: mocks.checkPublicRateLimit,
}));

function formData(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A preview deployment: the request host matches VERCEL_URL, which the
    // platform injects, so it is trusted and the reset link stays on the
    // deployment the admin is actually using.
    vi.stubEnv("VERCEL_URL", "vending-website.vercel.app");
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "vending-website.vercel.app",
        "x-forwarded-proto": "https",
      }),
    );
    mocks.checkPublicRateLimit.mockResolvedValue(true);
    mocks.sendPasswordSetupEmail.mockResolvedValue(undefined);
    mocks.maybeSingle.mockResolvedValue({
      data: { email: "admin@example.com", role: "admin" },
      error: null,
    });
  });

  it("sends a reset email only for allowlisted admin emails", async () => {
    const result = await requestPasswordReset(
      { status: "idle" },
      formData(" Admin@Example.com "),
    );

    expect(result).toEqual({
      status: "sent",
      email: "admin@example.com",
    });
    expect(mocks.sendPasswordSetupEmail).toHaveBeenCalledWith(
      expect.anything(),
      "admin@example.com",
      "https://vending-website.vercel.app",
    );
  });

  it("ignores a forged x-forwarded-host when building the reset link", async () => {
    // Otherwise a POST carrying this header produces a real recovery email
    // pointing at the attacker, and the one-time code in it exchanges for an
    // admin session.
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "evil.tld",
        "x-forwarded-proto": "https",
      }),
    );

    await requestPasswordReset(
      { status: "idle" },
      formData("admin@example.com"),
    );

    expect(mocks.sendPasswordSetupEmail).toHaveBeenCalledWith(
      expect.anything(),
      "admin@example.com",
      "https://www.vendingpreneurs.com",
    );
  });

  it("does not send reset emails to non-admin addresses but returns generic sent state", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await requestPasswordReset(
      { status: "idle" },
      formData("outsider@example.com"),
    );

    expect(result).toEqual({
      status: "sent",
      email: "outsider@example.com",
    });
    expect(mocks.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });

  it("rejects invalid email before looking up access", async () => {
    const result = await requestPasswordReset(
      { status: "idle" },
      formData("not an email"),
    );

    expect(result).toEqual({
      status: "error",
      message: "Enter a valid email address.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });
  it("refuses a throttled request before the allowlist lookup", async () => {
    mocks.checkPublicRateLimit.mockResolvedValue(false);

    const result = await requestPasswordReset(
      { status: "idle" },
      formData("admin@example.com"),
    );

    expect(result).toEqual({
      status: "error",
      message:
        "Too many submissions from this connection. Wait a few minutes and try again.",
    });
    expect(mocks.checkPublicRateLimit).toHaveBeenCalledWith(
      "admin_password_reset_ip",
      { ip: null },
    );
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });

  it("never logs the address when the reset email fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendPasswordSetupEmail.mockRejectedValue(new Error("smtp down"));

    const result = await requestPasswordReset(
      { status: "idle" },
      formData("admin@example.com"),
    );

    expect(result).toEqual({ status: "sent", email: "admin@example.com" });
    expect(JSON.stringify(spy.mock.calls)).toContain("smtp down");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("admin@example.com");
    spy.mockRestore();
  });
  it("checks the per-email budget after the per-IP one", async () => {
    mocks.checkPublicRateLimit
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await requestPasswordReset(
      { status: "idle" },
      formData("admin@example.com"),
    );

    expect(result.status).toBe("error");
    expect(mocks.checkPublicRateLimit).toHaveBeenLastCalledWith(
      "admin_password_reset_email",
      { ip: null, email: "admin@example.com" },
    );
    expect(mocks.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });
});
