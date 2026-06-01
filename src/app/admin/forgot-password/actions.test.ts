import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestPasswordReset } from "./actions";

const mocks = vi.hoisted(() => {
  const resetPasswordForEmail = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    createSupabaseClient: vi.fn(() => ({
      auth: { resetPasswordForEmail },
    })),
    createAdminClient: vi.fn(() => ({ from })),
    headers: vi.fn(),
    resetPasswordForEmail,
    maybeSingle,
    eq,
    select,
    from,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createSupabaseClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

function formData(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "vending-website.vercel.app",
        "x-forwarded-proto": "https",
      }),
    );
    mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
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
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "admin@example.com",
      {
        redirectTo:
          "https://vending-website.vercel.app/auth/callback?next=%2Fadmin%2Freset-password",
      },
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
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
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
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
