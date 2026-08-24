#!/usr/bin/env node
/**
 * One-off operational script for the production Calendly webhook subscription.
 *
 * Calendly returns a subscription's signing key ONCE, at creation time, and
 * never shows it again. That is the whole reason this is a script rather than
 * a click in the Calendly UI: the key has to be captured the moment it exists
 * so it can go straight into Vercel Production.
 *
 * The app's own Calendly client (src/lib/services/calendly-api.ts) is
 * deliberately read-only and stays that way -- the sweep has no business
 * being able to create webhooks. This script talks to the API directly.
 *
 *   CALENDLY_API_TOKEN=... node scripts/calendly-webhook-setup.mjs list
 *   CALENDLY_API_TOKEN=... node scripts/calendly-webhook-setup.mjs create
 *   CALENDLY_API_TOKEN=... node scripts/calendly-webhook-setup.mjs delete <uuid>
 *
 * `create` is idempotent by callback URL: it refuses rather than adding a
 * second subscription to the same endpoint, because duplicates mean every
 * booking is delivered twice.
 */

const API = "https://api.calendly.com";
const CALLBACK_URL = "https://www.vendingpreneurs.com/api/webhooks/calendly";
const EVENTS = ["invitee.created", "invitee.canceled"];

const token = process.env.CALENDLY_API_TOKEN?.trim();
if (!token) {
  console.error("CALENDLY_API_TOKEN is not set.");
  process.exit(1);
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    // Never echo the token back through an error message.
    const message = JSON.stringify(body).replaceAll(token, "<token>");
    throw new Error(`Calendly ${response.status} on ${path}: ${message}`);
  }
  return body;
}

/** Resolves the org uri from the token, tolerating a token without users:read. */
async function resolveOrganizationUri() {
  try {
    const me = await api("/users/me");
    if (me?.resource?.current_organization) {
      return {
        organization: me.resource.current_organization,
        user: me.resource.uri ?? null,
      };
    }
  } catch (error) {
    console.warn(`  /users/me unavailable (${error.message.slice(0, 80)}), trying memberships`);
  }
  const memberships = await api("/organization_memberships?count=1");
  const organization = memberships?.collection?.[0]?.organization;
  if (!organization) throw new Error("Could not resolve the Calendly organization from this token.");
  return { organization, user: memberships.collection[0]?.user?.uri ?? null };
}

async function listSubscriptions(organization) {
  const params = new URLSearchParams({ organization, scope: "organization", count: "100" });
  const data = await api(`/webhook_subscriptions?${params}`);
  return data?.collection ?? [];
}

function describe(subscription) {
  return [
    `  uri:      ${subscription.uri}`,
    `  callback: ${subscription.callback_url}`,
    `  state:    ${subscription.state}`,
    `  events:   ${(subscription.events ?? []).join(", ")}`,
    `  scope:    ${subscription.scope}`,
    `  created:  ${subscription.created_at}`,
  ].join("\n");
}

const [command, argument] = process.argv.slice(2);

const { organization } = await resolveOrganizationUri();
console.log(`Organization: ${organization}\n`);

if (command === "list") {
  const subscriptions = await listSubscriptions(organization);
  if (subscriptions.length === 0) {
    console.log("No webhook subscriptions on this organization.");
  }
  for (const subscription of subscriptions) {
    console.log(describe(subscription), "\n");
  }
  process.exit(0);
}

if (command === "create") {
  const existing = await listSubscriptions(organization);
  const duplicate = existing.find((s) => s.callback_url === CALLBACK_URL);
  if (duplicate) {
    // A second subscription on the same URL delivers every booking twice.
    console.error(`A subscription already points at ${CALLBACK_URL}:\n${describe(duplicate)}`);
    console.error("\nDelete it first if you need a fresh signing key. Refusing to duplicate.");
    process.exit(1);
  }

  const created = await api("/webhook_subscriptions", {
    method: "POST",
    body: JSON.stringify({
      url: CALLBACK_URL,
      events: EVENTS,
      organization,
      scope: "organization",
    }),
  });

  const resource = created?.resource ?? {};
  console.log("Created:\n" + describe(resource) + "\n");
  console.log("SIGNING KEY (shown once by Calendly, never again):");
  console.log(resource.signing_key ?? "(none returned -- check the response above)");
  process.exit(0);
}

if (command === "delete") {
  if (!argument) {
    console.error("Usage: delete <subscription uuid or full uri>");
    process.exit(1);
  }
  const uuid = argument.split("/").pop();
  await api(`/webhook_subscriptions/${uuid}`, { method: "DELETE" });
  console.log(`Deleted ${uuid}.`);
  process.exit(0);
}

console.error("Usage: calendly-webhook-setup.mjs list | create | delete <uuid>");
process.exit(1);
