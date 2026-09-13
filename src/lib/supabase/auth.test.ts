import { afterEach, describe, it, expect, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  AdminAuthorizationError,
  canEditAdmin,
  getAuthorizedAdmin,
  requireAdmin,
  requireReadAccess,
  requireSuperAdmin,
} from "./auth";
import { getDevAdminContext, isDevAdminAuthBypassEnabled } from "./dev-auth";
import type { Database } from "@/types/database";

// Next's real redirect() throws to abort the render. The mock has to throw
// too: if it merely recorded the call, requireAdmin would carry on and RETURN
// the viewer's context, and a test asserting "redirect was called" would pass
// against a gate that fails open.
const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

function rowFor(role: string, id = "u-1", email = "person@example.com") {
  return {
    user_id: id,
    email,
    role,
    added_at: new Date().toISOString(),
  };
}

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

describe("canEditAdmin", () => {
  it("admits admins and super admins and refuses viewers", () => {
    expect(canEditAdmin("admin")).toBe(true);
    expect(canEditAdmin("super_admin")).toBe(true);
    expect(canEditAdmin("viewer")).toBe(false);
  });
});

describe("viewer role", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.redirect.mockClear();
  });

  function clientsFor(role: string) {
    return {
      serverClient: buildServerClient({
        id: "u-viewer",
        email: "viewer@example.com",
      }),
      adminClient: buildAdminClient(
        rowFor(role, "u-viewer", "viewer@example.com"),
      ),
    };
  }

  it("resolves a viewer to a real context so read-only pages can render", async () => {
    const ctx = await getAuthorizedAdmin(clientsFor("viewer"));

    expect(ctx).toEqual({
      user: { id: "u-viewer", email: "viewer@example.com" },
      role: "viewer",
    });
  });

  it("still refuses a role that is not on the allowlist", async () => {
    // The role column is plain text. A typo or a hand-edited row must not
    // become admin access by default.
    const ctx = await getAuthorizedAdmin(clientsFor("editor"));

    expect(ctx).toBeNull();
  });

  it("lets a viewer through requireReadAccess", async () => {
    const ctx = await requireReadAccess(clientsFor("viewer"));

    expect(ctx.role).toBe("viewer");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("bounces a viewer out of requireAdmin, which gates every denied page", async () => {
    // requireAdmin is the gate on /admin/leads, /admin/chatbot and every
    // other editing surface and Server Action, so this one assertion is the
    // deny for all of them. It must THROW, not return.
    await expect(requireAdmin(clientsFor("viewer"))).rejects.toThrow(
      "NEXT_REDIRECT:/admin",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  });

  it("refuses a viewer at requireSuperAdmin with a catchable error", async () => {
    // Server Actions wrap this in try/catch and turn it into a message. A
    // redirect thrown here would be swallowed as a generic failure instead.
    await expect(
      requireSuperAdmin(clientsFor("viewer")),
    ).rejects.toBeInstanceOf(AdminAuthorizationError);
  });

  it("sends a signed-out visitor to the login page, not to /admin", async () => {
    await expect(
      requireAdmin({
        serverClient: buildServerClient(null),
        adminClient: buildAdminClient(null),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});

describe("existing roles are unchanged by the viewer slice", () => {
  afterEach(() => {
    mocks.redirect.mockClear();
  });

  it.each(["admin", "super_admin"])(
    "keeps full access for %s",
    async (role) => {
      const opts = {
        serverClient: buildServerClient({
          id: `u-${role}`,
          email: `${role}@example.com`,
        }),
        adminClient: buildAdminClient(
          rowFor(role, `u-${role}`, `${role}@example.com`),
        ),
      };

      const ctx = await requireAdmin(opts);

      expect(ctx.role).toBe(role);
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );

  it("still refuses a plain admin at requireSuperAdmin", async () => {
    await expect(
      requireSuperAdmin({
        serverClient: buildServerClient({
          id: "u-admin",
          email: "admin@example.com",
        }),
        adminClient: buildAdminClient(
          rowFor("admin", "u-admin", "admin@example.com"),
        ),
      }),
    ).rejects.toBeInstanceOf(AdminAuthorizationError);
  });
});
