import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loginWithPassword } from "./actions";

const mocks = vi.hoisted(() => {
  const signInWithPassword = vi.fn();
  const getUser = vi.fn();
  const signOut = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    createServerClient: vi.fn(() => ({
      auth: { signInWithPassword, getUser, signOut },
    })),
    createAdminClient: vi.fn(() => ({ from })),
    redirect: vi.fn(),
    checkPublicRateLimit: vi.fn(),
    signInWithPassword,
    getUser,
    signOut,
    maybeSingle,
    eq,
    select,
    from,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createServerClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
}));

vi.mock("@/lib/public-rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/public-rate-limit")>()),
  checkPublicRateLimit: mocks.checkPublicRateLimit,
}));

const THROTTLED =
  "Too many submissions from this connection. Wait a few minutes and try again.";

function formData({
  email = " Admin@Example.com ",
  password = "correct-password",
  next = "/admin/settings/users",
} = {}) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  data.set("next", next);
  return data;
}

function guestFormData({ password = "vending1234", next = "/admin" } = {}) {
  const data = new FormData();
  data.set("guest", "1");
  data.set("password", password);
  data.set("next", next);
  return data;
}

describe("loginWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_GUEST_EMAIL;
    mocks.checkPublicRateLimit.mockResolvedValue(true);
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: "u-admin", email: "admin@example.com" },
      },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: "u-admin",
        email: "admin@example.com",
        role: "admin",
        added_at: new Date().toISOString(),
      },
      error: null,
    });
  });

  it("signs in with email and password, then redirects to a safe admin path", async () => {
    await loginWithPassword({ status: "idle" }, formData());

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "correct-password",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/settings/users");
  });

  it("rejects invalid fields before calling Supabase", async () => {
    const result = await loginWithPassword(
      { status: "idle" },
      formData({ email: "bad", password: "short" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Enter a valid email address.",
      email: "",
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("allows existing short passwords to reach Supabase", async () => {
    await loginWithPassword(
      { status: "idle" },
      formData({ password: "short" }),
    );

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "short",
    });
  });

  it("returns a generic error when credentials are rejected", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { message: "invalid login credentials" },
    });

    const result = await loginWithPassword({ status: "idle" }, formData());

    expect(result).toEqual({
      status: "error",
      message: "Email or password is incorrect.",
      email: "admin@example.com",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("spends the sign-in budget keyed by IP and normalized email", async () => {
    await loginWithPassword({ status: "idle" }, formData());

    expect(mocks.checkPublicRateLimit.mock.calls).toEqual([
      ["admin_login_ip", { ip: "203.0.113.7" }],
      ["admin_login_email", { ip: null, email: "admin@example.com" }],
    ]);
  });

  it("refuses a throttled sign-in without calling Supabase", async () => {
    mocks.checkPublicRateLimit.mockResolvedValue(false);

    const result = await loginWithPassword({ status: "idle" }, formData());

    expect(result).toEqual({
      status: "error",
      message: THROTTLED,
      email: "admin@example.com",
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not spend budget on fields that fail validation", async () => {
    await loginWithPassword(
      { status: "idle" },
      formData({ email: "bad", password: "x" }),
    );

    expect(mocks.checkPublicRateLimit).not.toHaveBeenCalled();
  });

  it("signs out and rejects users without app access", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await loginWithPassword({ status: "idle" }, formData());

    expect(mocks.signOut).toHaveBeenCalled();
    expect(result).toEqual({
      status: "error",
      message: "This email does not have admin access.",
      email: "admin@example.com",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("loginWithPassword as guest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_GUEST_EMAIL = " Guest@Example.test ";
    mocks.checkPublicRateLimit.mockResolvedValue(true);
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u-guest", email: "guest@example.test" } },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: "u-guest",
        email: "guest@example.test",
        role: "viewer",
        added_at: new Date().toISOString(),
      },
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.ADMIN_GUEST_EMAIL;
  });

  it("signs in with the configured shared account and no submitted email", async () => {
    await loginWithPassword({ status: "idle" }, guestFormData());

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "guest@example.test",
      password: "vending1234",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  });

  it("ignores an email posted alongside the guest flag", async () => {
    const data = guestFormData();
    data.set("email", "attacker@example.com");

    await loginWithPassword({ status: "idle" }, data);

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "guest@example.test",
      password: "vending1234",
    });
  });

  it("fails closed when the shared account is not configured", async () => {
    delete process.env.ADMIN_GUEST_EMAIL;

    const result = await loginWithPassword({ status: "idle" }, guestFormData());

    expect(result).toEqual({
      status: "error",
      message: "Guest access is not set up yet.",
      email: "",
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("never echoes the shared address back to the browser", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { message: "invalid login credentials" },
    });

    const result = await loginWithPassword({ status: "idle" }, guestFormData());

    expect(result).toEqual({
      status: "error",
      message: "That password is incorrect.",
      email: "",
    });
  });

  it("signs out a shared account that lost its allowlist row", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await loginWithPassword({ status: "idle" }, guestFormData());

    expect(mocks.signOut).toHaveBeenCalled();
    expect(result?.status).toBe("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("checks the per-IP budget, then the shared guest budget", async () => {
    await loginWithPassword({ status: "idle" }, guestFormData());

    expect(mocks.checkPublicRateLimit.mock.calls).toEqual([
      ["admin_login_ip", { ip: "203.0.113.7" }],
      ["admin_login_email", { ip: null, email: "guest@example.test" }],
      ["admin_login_guest", { ip: null, email: "guest@example.test" }],
    ]);
  });

  it("refuses a throttled IP before spending the shared guest budget", async () => {
    mocks.checkPublicRateLimit.mockResolvedValueOnce(false);

    const result = await loginWithPassword({ status: "idle" }, guestFormData());

    expect(result).toEqual({ status: "error", message: THROTTLED, email: "" });
    expect(mocks.checkPublicRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("refuses when the shared guest budget is spent, without echoing the address", async () => {
    mocks.checkPublicRateLimit
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await loginWithPassword({ status: "idle" }, guestFormData());

    expect(result).toEqual({ status: "error", message: THROTTLED, email: "" });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
  it("spends the guest budget when the shared address is typed into the email form", async () => {
    await loginWithPassword(
      { status: "idle" },
      formData({ email: "guest@example.test" }),
    );

    expect(mocks.checkPublicRateLimit).toHaveBeenCalledWith(
      "admin_login_guest",
      { ip: null, email: "guest@example.test" },
    );
  });
});
