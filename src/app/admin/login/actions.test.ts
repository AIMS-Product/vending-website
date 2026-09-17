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
    process.env.ADMIN_GUEST_EMAIL = " Team@Vendingpreneurs.com ";
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u-guest", email: "team@vendingpreneurs.com" } },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: "u-guest",
        email: "team@vendingpreneurs.com",
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
      email: "team@vendingpreneurs.com",
      password: "vending1234",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  });

  it("ignores an email posted alongside the guest flag", async () => {
    const data = guestFormData();
    data.set("email", "attacker@example.com");

    await loginWithPassword({ status: "idle" }, data);

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "team@vendingpreneurs.com",
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
});
