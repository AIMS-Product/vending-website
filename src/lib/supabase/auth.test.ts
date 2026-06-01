import { afterEach, describe, it, expect, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  AdminAuthorizationError,
  getAuthorizedAdmin,
  requireSuperAdmin,
} from "./auth";
import { getDevAdminContext, isDevAdminAuthBypassEnabled } from "./dev-auth";
import type { Database } from "@/types/database";

type AppUserRow = Database["public"]["Tables"]["app_users"]["Row"];

function buildServerClient(user: Partial<User> | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: user as User | null },
        error: null,
      }),
    },
  } as unknown as SupabaseClient<Database>;
}

function buildAdminClient(row: AppUserRow | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient<Database>;
}

describe("getAuthorizedAdmin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the fixed dev admin when the development bypass flag is enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_DEV_AUTH_BYPASS", "1");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const ctx = await getAuthorizedAdmin({
      serverClient: {
        auth: {
          getUser: vi.fn().mockRejectedValue(new Error("should not be called")),
        },
      } as unknown as SupabaseClient<Database>,
      adminClient: buildAdminClient(null),
    });

    expect(ctx).toEqual(getDevAdminContext());
  });

  it("refuses the dev admin bypass outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_DEV_AUTH_BYPASS", "1");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(isDevAdminAuthBypassEnabled()).toBe(false);
    expect(getDevAdminContext()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "ADMIN_DEV_AUTH_BYPASS is set outside development and has been ignored.",
    );
  });

  it("returns null when no user is signed in", async () => {
    const ctx = await getAuthorizedAdmin({
      serverClient: buildServerClient(null),
      adminClient: buildAdminClient(null),
    });
    expect(ctx).toBeNull();
  });

  it("returns null when the signed-in user has no app_users row", async () => {
    const ctx = await getAuthorizedAdmin({
      serverClient: buildServerClient({
        id: "u-outsider",
        email: "outsider@example.com",
      }),
      adminClient: buildAdminClient(null),
    });
    expect(ctx).toBeNull();
  });

  it("returns null when the signed-in user has no email claim", async () => {
    // Edge case — the JWT could in principle land here without an email
    // (anonymous user, social sign-in misconfiguration). Treat as not-admin.
    const ctx = await getAuthorizedAdmin({
      serverClient: buildServerClient({ id: "u-anon", email: undefined }),
      adminClient: buildAdminClient({
        user_id: "u-anon",
        email: "x",
        role: "admin",
        added_at: new Date().toISOString(),
      }),
    });
    expect(ctx).toBeNull();
  });

  it("returns the user + role when the user has an app_users row", async () => {
    const ctx = await getAuthorizedAdmin({
      serverClient: buildServerClient({
        id: "u-admin",
        email: "admin@example.com",
      }),
      adminClient: buildAdminClient({
        user_id: "u-admin",
        email: "admin@example.com",
        role: "admin",
        added_at: new Date().toISOString(),
      }),
    });
    expect(ctx).toEqual({
      user: { id: "u-admin", email: "admin@example.com" },
      role: "admin",
    });
  });

  it("returns the super admin role when the app_users row is super_admin", async () => {
    const ctx = await getAuthorizedAdmin({
      serverClient: buildServerClient({
        id: "u-super",
        email: "super@example.com",
      }),
      adminClient: buildAdminClient({
        user_id: "u-super",
        email: "super@example.com",
        role: "super_admin",
        added_at: new Date().toISOString(),
      }),
    });
    expect(ctx).toEqual({
      user: { id: "u-super", email: "super@example.com" },
      role: "super_admin",
    });
  });

  it("returns null when the app_users lookup errors", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const adminClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    const ctx = await getAuthorizedAdmin({
      serverClient: buildServerClient({
        id: "u-admin",
        email: "admin@example.com",
      }),
      adminClient,
    });
    expect(ctx).toBeNull();
  });
});

describe("requireSuperAdmin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the current context for super admins", async () => {
    const ctx = await requireSuperAdmin({
      serverClient: buildServerClient({
        id: "u-super",
        email: "super@example.com",
      }),
      adminClient: buildAdminClient({
        user_id: "u-super",
        email: "super@example.com",
        role: "super_admin",
        added_at: new Date().toISOString(),
      }),
    });

    expect(ctx.role).toBe("super_admin");
  });

  it("throws a controlled authorization error for regular admins", async () => {
    await expect(
      requireSuperAdmin({
        serverClient: buildServerClient({
          id: "u-admin",
          email: "admin@example.com",
        }),
        adminClient: buildAdminClient({
          user_id: "u-admin",
          email: "admin@example.com",
          role: "admin",
          added_at: new Date().toISOString(),
        }),
      }),
    ).rejects.toBeInstanceOf(AdminAuthorizationError);
  });

  it("uses a super admin dev context when the development bypass is enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_DEV_AUTH_BYPASS", "1");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const ctx = await requireSuperAdmin();

    expect(ctx).toEqual({
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "dev-admin@dev.invalid",
      },
      role: "super_admin",
    });
  });
});
