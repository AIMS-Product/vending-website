import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  AppUserServiceError,
  changeAppUserRole,
  inviteAppUser,
  isMissingAppUserEventsTableError,
  isStaleAdminRoleConstraintError,
  LastSuperAdminError,
  removeAppUserAccess,
} from "./app-users";
import type { AdminContext } from "@/lib/supabase/auth";
import type { Database } from "@/types/database";

const actor: AdminContext = {
  user: { id: "owner-id", email: "owner@example.com" },
  role: "super_admin",
};

type AppUserRow = Database["public"]["Tables"]["app_users"]["Row"];
type AppUserEmailRow = Database["public"]["Tables"]["app_user_emails"]["Row"];
type EventRow = Database["public"]["Tables"]["app_user_events"]["Insert"];

type FakeState = {
  authUsers: Array<Partial<User> & { id: string; email?: string }>;
  appUsers: AppUserRow[];
  appUserEmails: AppUserEmailRow[];
  events: EventRow[];
};

function buildClient(state: Partial<FakeState> = {}) {
  const data: FakeState = {
    authUsers: [],
    appUsers: [],
    appUserEmails: [],
    events: [],
    ...state,
  };

  const resetPasswordForEmail = vi.fn().mockResolvedValue({
    data: {},
    error: null,
  });
  const createUser = vi.fn(async ({ email }: { email: string }) => {
    const user = {
      id: `auth-${data.authUsers.length + 1}`,
      email,
      banned_until: undefined,
    };
    data.authUsers.push(user);
    return { data: { user }, error: null };
  });
  const updateUserById = vi.fn(
    async (id: string, patch: { ban_duration?: string | "none" }) => {
      const user = data.authUsers.find((item) => item.id === id);
      if (user && patch.ban_duration) {
        user.banned_until =
          patch.ban_duration === "none" ? undefined : patch.ban_duration;
      }
      return { data: { user: user ?? null }, error: null };
    },
  );
  const listUsers = vi.fn().mockResolvedValue({
    data: { users: data.authUsers },
    error: null,
  });

  return {
    state: data,
    resetPasswordForEmail,
    createUser,
    updateUserById,
    listUsers,
    client: {
      auth: {
        resetPasswordForEmail,
        admin: { createUser, updateUserById, listUsers },
      },
      from(table: string) {
        return new FakeQuery(table, data);
      },
    } as unknown as SupabaseClient<Database>,
  };
}

class FakeQuery {
  private filters: Array<{ key: string; value: unknown }> = [];
  private orderKey: string | null = null;

  constructor(
    private table: string,
    private state: FakeState,
  ) {}

  select() {
    return this;
  }

  order(key: string) {
    this.orderKey = key;
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, value });
    return this;
  }

  async maybeSingle() {
    const rows = this.rows();
    return { data: rows[0] ?? null, error: null };
  }

  async upsert(value: AppUserEmailRow | AppUserRow) {
    if (this.table === "app_user_emails") {
      const row = value as AppUserEmailRow;
      this.state.appUserEmails = [
        ...this.state.appUserEmails.filter((item) => item.email !== row.email),
        { ...row, added_at: row.added_at ?? new Date().toISOString() },
      ];
    }
    if (this.table === "app_users") {
      const row = value as AppUserRow;
      this.state.appUsers = [
        ...this.state.appUsers.filter((item) => item.user_id !== row.user_id),
        { ...row, added_at: row.added_at ?? new Date().toISOString() },
      ];
    }
    return { data: value, error: null };
  }

  async insert(value: EventRow) {
    if (this.table === "app_user_events") {
      this.state.events.push(value);
    }
    return { data: value, error: null };
  }

  delete() {
    return {
      eq: async (key: string, value: unknown) => {
        if (this.table === "app_user_emails") {
          this.state.appUserEmails = this.state.appUserEmails.filter(
            (row) => row[key as keyof AppUserEmailRow] !== value,
          );
        }
        if (this.table === "app_users") {
          this.state.appUsers = this.state.appUsers.filter(
            (row) => row[key as keyof AppUserRow] !== value,
          );
        }
        return { data: null, error: null };
      },
    };
  }

  async update(patch: Partial<AppUserEmailRow | AppUserRow>) {
    const updateRow = <T extends { email: string }>(row: T) =>
      this.matches(row) ? { ...row, ...patch } : row;

    if (this.table === "app_user_emails") {
      this.state.appUserEmails = this.state.appUserEmails.map(updateRow);
    }
    if (this.table === "app_users") {
      this.state.appUsers = this.state.appUsers.map(updateRow);
    }
    return { data: null, error: null };
  }

  then(resolve: (value: { data: unknown[]; error: null }) => void) {
    resolve({ data: this.rows(), error: null });
  }

  private rows() {
    let rows: unknown[] = [];
    if (this.table === "app_user_emails") rows = this.state.appUserEmails;
    if (this.table === "app_users") rows = this.state.appUsers;
    if (this.table === "app_user_events") rows = this.state.events;
    const filtered = rows.filter((row) => this.matches(row as object));
    if (this.orderKey) {
      return [...filtered].sort((a, b) =>
        String(
          (a as Record<string, unknown>)[this.orderKey!] ?? "",
        ).localeCompare(
          String((b as Record<string, unknown>)[this.orderKey!] ?? ""),
        ),
      );
    }
    return filtered;
  }

  private matches(row: object) {
    return this.filters.every(
      ({ key, value }) => (row as Record<string, unknown>)[key] === value,
    );
  }
}

describe("app user service", () => {
  it("identifies the local missing audit-table error shape", () => {
    expect(
      isMissingAppUserEventsTableError(
        new AppUserServiceError(
          "Could not find the table 'public.app_user_events' in the schema cache",
        ),
      ),
    ).toBe(true);
    expect(
      isMissingAppUserEventsTableError(new AppUserServiceError("Other error")),
    ).toBe(false);
  });

  it("identifies the stale role-constraint error shape", () => {
    expect(
      isStaleAdminRoleConstraintError(
        new AppUserServiceError(
          'new row for relation "app_user_emails" violates check constraint "app_user_emails_role_check"',
        ),
      ),
    ).toBe(true);
    expect(
      isStaleAdminRoleConstraintError(
        new AppUserServiceError(
          'new row for relation "app_users" violates check constraint "app_users_role_check"',
        ),
      ),
    ).toBe(true);
    expect(
      isStaleAdminRoleConstraintError(new AppUserServiceError("Other error")),
    ).toBe(false);
  });

  it("creates a new auth user, grants access, sends setup, and logs the invite", async () => {
    const fake = buildClient();

    await inviteAppUser(
      { email: " New.Admin@Example.com ", role: "admin" },
      actor,
      {
        client: fake.client,
        origin: "https://vending-website.vercel.app",
      },
    );

    expect(fake.createUser).toHaveBeenCalledWith({
      email: "new.admin@example.com",
      email_confirm: true,
    });
    expect(fake.state.appUserEmails).toContainEqual(
      expect.objectContaining({
        email: "new.admin@example.com",
        role: "admin",
      }),
    );
    expect(fake.state.appUsers).toContainEqual(
      expect.objectContaining({
        email: "new.admin@example.com",
        role: "admin",
      }),
    );
    expect(fake.resetPasswordForEmail).toHaveBeenCalled();
    expect(fake.state.events).toContainEqual(
      expect.objectContaining({
        event_type: "invited",
        target_email: "new.admin@example.com",
      }),
    );
  });

  it("reuses and unbans an existing auth user instead of creating a duplicate", async () => {
    const fake = buildClient({
      authUsers: [
        {
          id: "existing-id",
          email: "existing@example.com",
          banned_until: "876000h",
        },
      ],
    });

    await inviteAppUser(
      { email: "existing@example.com", role: "super_admin" },
      actor,
      { client: fake.client, origin: "https://vending-website.vercel.app" },
    );

    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.updateUserById).toHaveBeenCalledWith("existing-id", {
      ban_duration: "none",
    });
    expect(fake.state.appUsers).toContainEqual(
      expect.objectContaining({
        user_id: "existing-id",
        email: "existing@example.com",
        role: "super_admin",
      }),
    );
  });

  it("blocks demoting the last super admin and logs the attempt", async () => {
    const fake = buildClient({
      appUsers: [
        {
          user_id: "owner-id",
          email: "owner@example.com",
          role: "super_admin",
          added_at: new Date().toISOString(),
        },
      ],
      appUserEmails: [
        {
          email: "owner@example.com",
          role: "super_admin",
          added_at: new Date().toISOString(),
        },
      ],
    });

    await expect(
      changeAppUserRole({ email: "owner@example.com", role: "admin" }, actor, {
        client: fake.client,
      }),
    ).rejects.toBeInstanceOf(LastSuperAdminError);

    expect(fake.state.events).toContainEqual(
      expect.objectContaining({
        event_type: "self_lockout_blocked",
        target_email: "owner@example.com",
      }),
    );
  });

  it("removes app access, disables the auth user, and logs removal", async () => {
    const fake = buildClient({
      authUsers: [{ id: "admin-id", email: "admin@example.com" }],
      appUsers: [
        {
          user_id: "owner-id",
          email: "owner@example.com",
          role: "super_admin",
          added_at: new Date().toISOString(),
        },
        {
          user_id: "admin-id",
          email: "admin@example.com",
          role: "admin",
          added_at: new Date().toISOString(),
        },
      ],
      appUserEmails: [
        {
          email: "admin@example.com",
          role: "admin",
          added_at: new Date().toISOString(),
        },
      ],
    });

    await removeAppUserAccess({ email: "admin@example.com" }, actor, {
      client: fake.client,
    });

    expect(fake.state.appUserEmails).toEqual([]);
    expect(
      fake.state.appUsers.some((row) => row.email === "admin@example.com"),
    ).toBe(false);
    expect(fake.updateUserById).toHaveBeenCalledWith("admin-id", {
      ban_duration: "876000h",
    });
    expect(fake.state.events).toContainEqual(
      expect.objectContaining({
        event_type: "access_removed",
        target_email: "admin@example.com",
      }),
    );
  });
});
