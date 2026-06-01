import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeUserRole,
  inviteUser,
  removeUserAccess,
  resendUserSetup,
} from "./actions";

const mocks = vi.hoisted(() => {
  class AdminAuthorizationError extends Error {
    constructor() {
      super("Super admin access is required.");
      this.name = "AdminAuthorizationError";
    }
  }
  class LastSuperAdminError extends Error {
    constructor() {
      super("At least one super admin must remain.");
      this.name = "LastSuperAdminError";
    }
  }

  return {
    AdminAuthorizationError,
    LastSuperAdminError,
    requireSuperAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    headers: vi.fn(),
    inviteAppUser: vi.fn(),
    sendAppUserPasswordSetup: vi.fn(),
    changeAppUserRole: vi.fn(),
    removeAppUserAccess: vi.fn(),
    isStaleAdminRoleConstraintError: vi.fn(
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("app_user_emails_role_check"),
    ),
  };
});

vi.mock("@/lib/supabase/auth", () => ({
  AdminAuthorizationError: mocks.AdminAuthorizationError,
  requireSuperAdmin: mocks.requireSuperAdmin,
}));

vi.mock("@/lib/services/app-users", () => ({
  LastSuperAdminError: mocks.LastSuperAdminError,
  inviteAppUser: mocks.inviteAppUser,
  sendAppUserPasswordSetup: mocks.sendAppUserPasswordSetup,
  changeAppUserRole: mocks.changeAppUserRole,
  removeAppUserAccess: mocks.removeAppUserAccess,
  isStaleAdminRoleConstraintError: mocks.isStaleAdminRoleConstraintError,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

const actor = {
  user: { id: "owner-id", email: "owner@example.com" },
  role: "super_admin" as const,
};

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("settings user actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperAdmin.mockResolvedValue(actor);
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "vending-website.vercel.app",
        "x-forwarded-proto": "https",
      }),
    );
  });

  it("invites a user as the current super admin", async () => {
    const result = await inviteUser(
      { status: "idle" },
      formData({ email: "New@Example.com", role: "admin" }),
    );

    expect(result).toEqual({
      status: "saved",
      message: "User invited.",
    });
    expect(mocks.inviteAppUser).toHaveBeenCalledWith(
      { email: "new@example.com", role: "admin" },
      actor,
      {
        origin: "https://vending-website.vercel.app",
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings/users");
  });

  it("returns inline errors for regular admins attempting mutations", async () => {
    mocks.requireSuperAdmin.mockRejectedValue(
      new mocks.AdminAuthorizationError(),
    );

    const result = await removeUserAccess(
      { status: "idle" },
      formData({ email: "admin@example.com" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Only super admins can manage users.",
    });
    expect(mocks.removeAppUserAccess).not.toHaveBeenCalled();
  });

  it("rejects invalid roles before calling the service", async () => {
    const result = await changeUserRole(
      { status: "idle" },
      formData({ email: "admin@example.com", role: "editor" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Choose a valid role.",
    });
    expect(mocks.changeAppUserRole).not.toHaveBeenCalled();
  });

  it("returns a migration-focused error when the remote role constraint is stale", async () => {
    mocks.changeAppUserRole.mockRejectedValue(
      new Error(
        'new row for relation "app_user_emails" violates check constraint "app_user_emails_role_check"',
      ),
    );

    const result = await changeUserRole(
      { status: "idle" },
      formData({ email: "admin@example.com", role: "super_admin" }),
    );

    expect(result).toEqual({
      status: "error",
      message:
        "The admin-role migration is pending. Apply migration 20260601100000 before assigning super admin access.",
    });
  });

  it("does not expose unexpected service errors to the client", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.inviteAppUser.mockRejectedValue(new Error("service secret detail"));

    const result = await inviteUser(
      { status: "idle" },
      formData({ email: "admin@example.com", role: "admin" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Could not invite user.",
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("delegates setup resend and access removal", async () => {
    await resendUserSetup(
      { status: "idle" },
      formData({ email: "admin@example.com" }),
    );
    await removeUserAccess(
      { status: "idle" },
      formData({ email: "admin@example.com" }),
    );

    expect(mocks.sendAppUserPasswordSetup).toHaveBeenCalledWith(
      { email: "admin@example.com" },
      actor,
      {
        origin: "https://vending-website.vercel.app",
      },
    );
    expect(mocks.removeAppUserAccess).toHaveBeenCalledWith(
      { email: "admin@example.com" },
      actor,
    );
  });
});
