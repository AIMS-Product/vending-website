import { describe, expect, it, vi, beforeEach } from "vitest";
import { requestMagicLink } from "./actions";

const mocks = vi.hoisted(() => {
  const signInWithOtp = vi.fn();
  return {
    createSupabaseClient: vi.fn(() => ({ auth: { signInWithOtp } })),
    headers: vi.fn(),
    signInWithOtp,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createSupabaseClient,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

function formData(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("requestMagicLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "vending-website.vercel.app",
        "x-forwarded-proto": "https",
      }),
    );
    mocks.signInWithOtp.mockResolvedValue({ error: null });
  });

  it("sends implicit-flow magic links back to the live login page", async () => {
    const result = await requestMagicLink(
      { status: "idle" },
      formData(" JamesV@AImanagingservices.com "),
    );

    expect(result).toEqual({
      status: "sent",
      email: "jamesv@aimanagingservices.com",
    });
    expect(mocks.createSupabaseClient).toHaveBeenCalledWith(
      "http://localhost:54321",
      "vitest_anon_key_placeholder______",
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: "implicit",
          persistSession: false,
        },
      },
    );
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "jamesv@aimanagingservices.com",
      options: {
        emailRedirectTo: "https://vending-website.vercel.app/admin/login",
        shouldCreateUser: true,
      },
    });
  });

  it("does not call Supabase for invalid email input", async () => {
    const result = await requestMagicLink(
      { status: "idle" },
      formData("not an email"),
    );

    expect(result).toEqual({
      status: "error",
      message: "Enter a valid email address.",
    });
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("returns the generic failure message when Supabase rejects the send", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.signInWithOtp.mockResolvedValue({
      error: { message: "provider rejected" },
    });

    const result = await requestMagicLink(
      { status: "idle" },
      formData("jamesv@aimanagingservices.com"),
    );

    expect(result).toEqual({
      status: "error",
      message: "Couldn't send the link. Try again in a moment.",
    });
    consoleSpy.mockRestore();
  });
});
