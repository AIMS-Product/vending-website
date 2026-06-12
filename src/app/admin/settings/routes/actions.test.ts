import { beforeEach, describe, expect, it, vi } from "vitest";
import { addRoutePrefix, removeRoutePrefix } from "./actions";

const mocks = vi.hoisted(() => {
  class AdminAuthorizationError extends Error {
    constructor() {
      super("Super admin access is required.");
      this.name = "AdminAuthorizationError";
    }
  }
  class RoutePrefixServiceError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "RoutePrefixServiceError";
    }
  }

  return {
    AdminAuthorizationError,
    RoutePrefixServiceError,
    requireSuperAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    adminCreateRoutePrefix: vi.fn(),
    adminDeleteRoutePrefix: vi.fn(),
  };
});

vi.mock("@/lib/supabase/auth", () => ({
  AdminAuthorizationError: mocks.AdminAuthorizationError,
  requireSuperAdmin: mocks.requireSuperAdmin,
}));

vi.mock("@/lib/services/route-prefixes", () => ({
  RoutePrefixServiceError: mocks.RoutePrefixServiceError,
  adminCreateRoutePrefix: mocks.adminCreateRoutePrefix,
  adminDeleteRoutePrefix: mocks.adminDeleteRoutePrefix,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
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

describe("settings route prefix actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperAdmin.mockResolvedValue(actor);
  });

  it("adds a route prefix as the current super admin", async () => {
    const result = await addRoutePrefix(
      { status: "idle" },
      formData({ prefix: "/guides", label: "Guides" }),
    );

    expect(result).toEqual({
      status: "saved",
      message: "Route prefix added.",
    });
    expect(mocks.adminCreateRoutePrefix).toHaveBeenCalledWith({
      prefix: "/guides",
      label: "Guides",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings/routes");
  });

  it("returns inline errors for regular admins attempting mutations", async () => {
    mocks.requireSuperAdmin.mockRejectedValue(
      new mocks.AdminAuthorizationError(),
    );

    const result = await removeRoutePrefix(
      { status: "idle" },
      formData({ prefix: "/guides" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Only super admins can manage route prefixes.",
    });
    expect(mocks.adminDeleteRoutePrefix).not.toHaveBeenCalled();
  });

  it("surfaces service validation messages inline", async () => {
    mocks.adminCreateRoutePrefix.mockRejectedValue(
      new mocks.RoutePrefixServiceError(
        "That route prefix is reserved and cannot be used.",
      ),
    );

    const result = await addRoutePrefix(
      { status: "idle" },
      formData({ prefix: "/admin", label: "" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "That route prefix is reserved and cannot be used.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not expose unexpected service errors to the client", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.adminCreateRoutePrefix.mockRejectedValue(
      new Error("service secret detail"),
    );

    const result = await addRoutePrefix(
      { status: "idle" },
      formData({ prefix: "/guides", label: "" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Could not add route prefix.",
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("deletes a route prefix and revalidates the settings page", async () => {
    const result = await removeRoutePrefix(
      { status: "idle" },
      formData({ prefix: "/guides" }),
    );

    expect(result).toEqual({
      status: "saved",
      message: "Route prefix deleted.",
    });
    expect(mocks.adminDeleteRoutePrefix).toHaveBeenCalledWith({
      prefix: "/guides",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings/routes");
  });
});
