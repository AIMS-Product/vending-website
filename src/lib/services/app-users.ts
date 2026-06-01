import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { buildPasswordResetRedirectUrl } from "@/lib/supabase/auth-redirects";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminContext, AdminRole } from "@/lib/supabase/auth";
import type { Database, Json } from "@/types/database";

export type AppUserRole = AdminRole;

export type AppUserListItem = {
  email: string;
  role: AppUserRole;
  status: "active" | "pending_setup";
  addedAt: string;
  userId: string | null;
};

export type AppUserEvent = {
  id: string;
  eventType: string;
  actorEmail: string;
  targetEmail: string;
  oldRole: AppUserRole | null;
  newRole: AppUserRole | null;
  createdAt: string;
};

type AppUserEventInsert =
  Database["public"]["Tables"]["app_user_events"]["Insert"];

type ServiceDeps = {
  client?: SupabaseClient<Database>;
  origin?: string;
};

export class AppUserServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppUserServiceError";
  }
}

export class LastSuperAdminError extends AppUserServiceError {
  constructor() {
    super("At least one super admin must remain.");
    this.name = "LastSuperAdminError";
  }
}

export function isMissingAppUserEventsTableError(error: unknown) {
  return (
    error instanceof AppUserServiceError &&
    error.message.includes("app_user_events") &&
    error.message.includes("schema cache")
  );
}

export function isStaleAdminRoleConstraintError(error: unknown) {
  return (
    error instanceof AppUserServiceError &&
    error.message.includes("violates check constraint") &&
    (error.message.includes("app_user_emails_role_check") ||
      error.message.includes("app_users_role_check"))
  );
}

export async function adminListAppUsers(deps: ServiceDeps = {}) {
  const client = serviceClient(deps);
  const [inviteRows, appUserRows, authUsers] = await Promise.all([
    listInviteRows(client),
    listAppUserRows(client),
    listAuthUsers(client),
  ]);
  const authByEmail = new Map(
    authUsers.flatMap((user) =>
      user.email ? [[normalizeEmail(user.email), user] as const] : [],
    ),
  );
  const appUserByEmail = new Map(
    appUserRows.map((row) => [normalizeEmail(row.email), row]),
  );
  const inviteByEmail = new Map(
    inviteRows.map((row) => [normalizeEmail(row.email), row]),
  );
  const emails = Array.from(
    new Set([...inviteByEmail.keys(), ...appUserByEmail.keys()]),
  ).sort();

  return emails.map((email): AppUserListItem => {
    const invite = inviteByEmail.get(email);
    const appUser = appUserByEmail.get(email);
    const authUser = authByEmail.get(email);
    const role = requireAppUserRole(appUser?.role ?? invite?.role ?? "admin");
    return {
      email,
      role,
      status: appUser && authUser?.last_sign_in_at ? "active" : "pending_setup",
      addedAt: appUser?.added_at ?? invite?.added_at ?? "",
      userId: appUser?.user_id ?? authUser?.id ?? null,
    };
  });
}

export async function adminListAppUserEvents(deps: ServiceDeps = {}) {
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("app_user_events")
    .select(
      "id, event_type, actor_email, target_email, old_role, new_role, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new AppUserServiceError(error.message);

  return (data ?? []).map(
    (row): AppUserEvent => ({
      id: row.id,
      eventType: row.event_type,
      actorEmail: row.actor_email,
      targetEmail: row.target_email,
      oldRole: row.old_role ? requireAppUserRole(row.old_role) : null,
      newRole: row.new_role ? requireAppUserRole(row.new_role) : null,
      createdAt: row.created_at,
    }),
  );
}

export async function inviteAppUser(
  input: { email: string; role: AppUserRole },
  actor: AdminContext,
  deps: ServiceDeps = {},
) {
  const client = serviceClient(deps);
  const email = normalizeEmail(input.email);
  const role = requireAppUserRole(input.role);
  const existingAuthUser = await findAuthUserByEmail(client, email);
  let authUser = existingAuthUser;

  if (!authUser) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new AppUserServiceError(error?.message ?? "Could not create user.");
    }
    authUser = data.user;
  } else if (authUser.banned_until) {
    const { error } = await client.auth.admin.updateUserById(authUser.id, {
      ban_duration: "none",
    });
    if (error) throw new AppUserServiceError(error.message);
  }

  await upsertInvite(client, { email, role });
  await upsertAppUser(client, {
    user_id: authUser.id,
    email,
    role,
  });
  await sendPasswordEmail(client, email, deps.origin);
  await logAppUserEvent(client, {
    actor,
    eventType: "invited",
    targetEmail: email,
    targetUserId: authUser.id,
    newRole: role,
  });

  return { email, role, userId: authUser.id };
}

export async function sendAppUserPasswordSetup(
  input: { email: string },
  actor: AdminContext,
  deps: ServiceDeps = {},
) {
  const client = serviceClient(deps);
  const email = normalizeEmail(input.email);
  const invite = await getInviteByEmail(client, email);
  const appUser = await getAppUserByEmail(client, email);
  if (!invite && !appUser) {
    throw new AppUserServiceError("User does not have app access.");
  }

  await sendPasswordEmail(client, email, deps.origin);
  await logAppUserEvent(client, {
    actor,
    eventType: appUser ? "password_reset_sent" : "setup_resent",
    targetEmail: email,
    targetUserId: appUser?.user_id ?? null,
  });
}

export async function changeAppUserRole(
  input: { email: string; role: AppUserRole },
  actor: AdminContext,
  deps: ServiceDeps = {},
) {
  const client = serviceClient(deps);
  const email = normalizeEmail(input.email);
  const nextRole = requireAppUserRole(input.role);
  const [invite, appUser] = await Promise.all([
    getInviteByEmail(client, email),
    getAppUserByEmail(client, email),
  ]);
  const oldRole = appUser?.role ?? invite?.role ?? null;

  if (!oldRole) {
    throw new AppUserServiceError("User does not have app access.");
  }

  if (
    oldRole === "super_admin" &&
    nextRole !== "super_admin" &&
    !(await hasAnotherSuperAdmin(client, email))
  ) {
    await logAppUserEvent(client, {
      actor,
      eventType: "self_lockout_blocked",
      targetEmail: email,
      targetUserId: appUser?.user_id ?? null,
      oldRole,
      newRole: nextRole,
    });
    throw new LastSuperAdminError();
  }

  await upsertInvite(client, { email, role: nextRole });
  if (appUser) {
    await upsertAppUser(client, {
      user_id: appUser.user_id,
      email,
      role: nextRole,
    });
  }
  await logAppUserEvent(client, {
    actor,
    eventType: "role_changed",
    targetEmail: email,
    targetUserId: appUser?.user_id ?? null,
    oldRole: requireAppUserRole(oldRole),
    newRole: nextRole,
  });

  return { email, role: nextRole };
}

export async function removeAppUserAccess(
  input: { email: string },
  actor: AdminContext,
  deps: ServiceDeps = {},
) {
  const client = serviceClient(deps);
  const email = normalizeEmail(input.email);
  const [invite, appUser, authUser] = await Promise.all([
    getInviteByEmail(client, email),
    getAppUserByEmail(client, email),
    findAuthUserByEmail(client, email),
  ]);

  if (!invite && !appUser) {
    return { email, removed: false, authUserDisabled: false };
  }

  if (
    appUser?.role === "super_admin" &&
    !(await hasAnotherSuperAdmin(client, email))
  ) {
    await logAppUserEvent(client, {
      actor,
      eventType: "self_lockout_blocked",
      targetEmail: email,
      targetUserId: appUser.user_id,
      oldRole: "super_admin",
    });
    throw new LastSuperAdminError();
  }

  await deleteByEmail(client, "app_user_emails", email);
  await deleteByEmail(client, "app_users", email);

  let authUserDisabled = false;
  if (authUser) {
    const { error } = await client.auth.admin.updateUserById(authUser.id, {
      ban_duration: "876000h",
    });
    if (error) {
      console.error("app user auth disable failed", { email, error });
    } else {
      authUserDisabled = true;
      await logAppUserEvent(client, {
        actor,
        eventType: "auth_user_disabled",
        targetEmail: email,
        targetUserId: authUser.id,
      });
    }
  }

  await logAppUserEvent(client, {
    actor,
    eventType: "access_removed",
    targetEmail: email,
    targetUserId: appUser?.user_id ?? authUser?.id ?? null,
    oldRole: appUser?.role ? requireAppUserRole(appUser.role) : null,
  });

  return { email, removed: true, authUserDisabled };
}

function serviceClient(deps: ServiceDeps) {
  return deps.client ?? createAdminClient();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function requireAppUserRole(value: string): AppUserRole {
  if (value === "admin" || value === "super_admin") return value;
  throw new AppUserServiceError("Invalid app user role.");
}

async function listInviteRows(client: SupabaseClient<Database>) {
  const { data, error } = await client
    .from("app_user_emails")
    .select("email, role, added_at")
    .order("email");
  if (error) throw new AppUserServiceError(error.message);
  return data ?? [];
}

async function listAppUserRows(client: SupabaseClient<Database>) {
  const { data, error } = await client
    .from("app_users")
    .select("user_id, email, role, added_at")
    .order("email");
  if (error) throw new AppUserServiceError(error.message);
  return data ?? [];
}

async function listAuthUsers(client: SupabaseClient<Database>) {
  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw new AppUserServiceError(error.message);
  return data.users;
}

async function findAuthUserByEmail(
  client: SupabaseClient<Database>,
  email: string,
): Promise<User | null> {
  const users = await listAuthUsers(client);
  return (
    users.find((user) => user.email && normalizeEmail(user.email) === email) ??
    null
  );
}

async function getInviteByEmail(
  client: SupabaseClient<Database>,
  email: string,
) {
  const { data, error } = await client
    .from("app_user_emails")
    .select("email, role, added_at")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new AppUserServiceError(error.message);
  return data;
}

async function getAppUserByEmail(
  client: SupabaseClient<Database>,
  email: string,
) {
  const { data, error } = await client
    .from("app_users")
    .select("user_id, email, role, added_at")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new AppUserServiceError(error.message);
  return data;
}

async function hasAnotherSuperAdmin(
  client: SupabaseClient<Database>,
  targetEmail: string,
) {
  const { data, error } = await client
    .from("app_users")
    .select("user_id, email, role")
    .eq("role", "super_admin");
  if (error) throw new AppUserServiceError(error.message);
  return (data ?? []).some((row) => normalizeEmail(row.email) !== targetEmail);
}

async function upsertInvite(
  client: SupabaseClient<Database>,
  input: { email: string; role: AppUserRole },
) {
  const { error } = await client.from("app_user_emails").upsert({
    email: input.email,
    role: input.role,
  });
  if (error) throw new AppUserServiceError(error.message);
}

async function upsertAppUser(
  client: SupabaseClient<Database>,
  input: { user_id: string; email: string; role: AppUserRole },
) {
  const { error } = await client.from("app_users").upsert(input);
  if (error) throw new AppUserServiceError(error.message);
}

async function deleteByEmail(
  client: SupabaseClient<Database>,
  table: "app_user_emails" | "app_users",
  email: string,
) {
  const { error } = await client.from(table).delete().eq("email", email);
  if (error) throw new AppUserServiceError(error.message);
}

async function sendPasswordEmail(
  client: SupabaseClient<Database>,
  email: string,
  origin: string | undefined,
) {
  if (!origin) return;

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: buildPasswordResetRedirectUrl(origin),
  });
  if (error) throw new AppUserServiceError(error.message);
}

async function logAppUserEvent(
  client: SupabaseClient<Database>,
  input: {
    actor: AdminContext;
    eventType: AppUserEventInsert["event_type"];
    targetEmail: string;
    targetUserId?: string | null;
    oldRole?: AppUserRole | null;
    newRole?: AppUserRole | null;
    metadata?: Json;
  },
) {
  const row: AppUserEventInsert = {
    event_type: input.eventType,
    actor_user_id: input.actor.user.id,
    actor_email: input.actor.user.email,
    target_user_id: input.targetUserId ?? null,
    target_email: input.targetEmail,
    old_role: input.oldRole ?? null,
    new_role: input.newRole ?? null,
    metadata: input.metadata ?? {},
  };
  const { error } = await client.from("app_user_events").insert(row);
  if (error) throw new AppUserServiceError(error.message);
}
