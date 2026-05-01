import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthorizedAdmin } from "./auth";
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
