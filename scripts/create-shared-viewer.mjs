/**
 * Create (or reset) the shared read-only team login.
 *
 * A viewer can open the whole studio and change nothing. There is no audit
 * trail on a shared password, so anyone who needs one gets their own `admin`
 * account from /admin/settings/users instead.
 *
 * Usage:
 *   node --env-file=.env.local scripts/create-shared-viewer.mjs \
 *     --email team@vendingpreneurs.com --password 'secret'
 *
 * Re-running resets the password on the existing account, which is how you
 * rotate it after someone leaves.
 */
import { createClient } from "@supabase/supabase-js";

function arg(name) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const email = (arg("email") ?? "").trim().toLowerCase();
const password = arg("password") ?? "";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password) {
  console.error("Usage: --email <address> --password <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error(
    "Password must be at least 8 characters (the sign-in form enforces this).",
  );
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(message, error) {
  console.error(message, error?.message ?? error ?? "");
  process.exit(1);
}

/**
 * `listUsers` pages at 50 by default, and this project's `app_users` roster is
 * small enough that one page of 200 covers it. If it ever isn't, this exits
 * rather than silently creating a duplicate auth user for the same address.
 */
async function findByEmail() {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) fail("Could not list users:", error);
  if (data.users.length === 200) {
    fail(
      "More than 200 auth users; widen the lookup before trusting this script.",
    );
  }
  return data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
}

const existing = await findByEmail();
let userId = existing?.id;

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    ban_duration: "none",
  });
  if (error) fail("Could not reset the password:", error);
  console.log(`Reset password for existing account ${email}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) fail("Could not create the account:", error);
  userId = data.user.id;
  console.log(`Created account ${email}`);
}

// The allowlist row is what actually grants access; the auth user alone gets
// bounced at the proxy. Upsert so a re-run repairs a missing or drifted row.
const { error: rowError } = await admin
  .from("app_users")
  .upsert(
    { user_id: userId, email, role: "viewer" },
    { onConflict: "user_id" },
  );
if (rowError) fail("Could not write the app_users row:", rowError);

const { data: check, error: checkError } = await admin
  .from("app_users")
  .select("email, role")
  .eq("user_id", userId)
  .single();
if (checkError || check?.role !== "viewer") {
  fail("Wrote the row but it did not read back as a viewer:", checkError);
}

console.log(
  `${check.email} is now a read-only viewer. Sign in at /admin/login.`,
);
