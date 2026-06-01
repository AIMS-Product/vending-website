import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePassword } from "./actions";

const mocks = vi.hoisted(() => {
  const updateUser = vi.fn();
  const getUser = vi.fn();
  const signOut = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    createServerClient: vi.fn(() => ({
      auth: { updateUser, getUser, signOut },
    })),
    createAdminClient: vi.fn(() => ({ from })),
    updateUser,
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

function formData(password = "new-strong-password", confirm = password) {
  const data = new FormData();
  data.set("password", password);
  data.set("confirmPassword", confirm);
  return data;
}

describe("updatePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
  });

  it("updates the password after verifying active app access", async () => {
    const result = await updatePassword({ status: "idle" }, formData());

    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "new-strong-password",
    });
    expect(result).toEqual({ status: "success" });
  });

  it("rejects reset attempts for users without app access", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await updatePassword({ status: "idle" }, formData());

    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "error",
      message: "This account no longer has admin access.",
    });
  });

  it("validates password confirmation before updating", async () => {
    const result = await updatePassword(
      { status: "idle" },
      formData("new-strong-password", "different-password"),
    );

    expect(result).toEqual({
      status: "error",
      message: "Passwords do not match.",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
