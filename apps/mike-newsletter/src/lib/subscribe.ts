import "server-only";

/**
 * Where a signup actually goes.
 *
 * ActiveCampaign is the newsletter platform. The generic webhook below it is
 * an escape hatch — useful for pointing signups at Zapier/Make or a staging
 * sink while the AC account is being set up — and is only used when the
 * ActiveCampaign variables are absent.
 *
 *   1. ActiveCampaign  ACTIVECAMPAIGN_API_URL + ACTIVECAMPAIGN_API_KEY
 *                      + ACTIVECAMPAIGN_LIST_ID
 *   2. Webhook         SUBSCRIBE_WEBHOOK_URL
 *
 * With neither configured the form reports an explicit "not connected yet"
 * error rather than showing a success screen it can't honour. A subscriber
 * who is told they're in and then never hears from us is worse than a visible
 * error on a page nobody has pointed a domain at yet.
 */

export type SubscribeOutcome =
  | { ok: true }
  | { ok: false; reason: "invalid" | "unconfigured" | "provider" };

// Deliberately loose. The only thing worth rejecting at this stage is input
// that cannot be an address at all; anything subtler belongs to the ESP's
// own verification, and a clever regex here just rejects real people.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  return EMAIL.test(email) ? email : null;
}

type Provider = {
  name: string;
  send: (email: string, source: string) => Promise<boolean>;
};

/**
 * ActiveCampaign, API v3.
 *
 * Two calls, in order:
 *
 *   POST /api/3/contact/sync   create or update the contact (idempotent, so a
 *                              repeat signup is not an error)
 *   POST /api/3/contactLists   subscribe that contact to the list
 *
 * The second call is the one that matters. A contact that exists but is on no
 * list receives nothing, so a failure there is reported as a failure even
 * though the first call succeeded — better a visible retry than a silent
 * orphan in the contact table.
 *
 * If the list is set to double opt-in in ActiveCampaign, AC sends the
 * confirmation email itself; nothing here needs to change.
 */
function activeCampaign(
  baseUrl: string,
  apiKey: string,
  listId: string,
): Provider {
  const root = baseUrl.replace(/\/+$/, "");
  const headers = {
    "Api-Token": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Optional: an ActiveCampaign custom field to stamp with which block on the
  // page sent the signup, and a tag to apply. Both are skipped when unset.
  const sourceFieldId = process.env.ACTIVECAMPAIGN_SOURCE_FIELD_ID;
  const tagId = process.env.ACTIVECAMPAIGN_TAG_ID;

  return {
    name: "activecampaign",
    send: async (email, source) => {
      const syncResponse = await fetch(`${root}/api/3/contact/sync`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contact: {
            email,
            ...(sourceFieldId
              ? { fieldValues: [{ field: sourceFieldId, value: source }] }
              : {}),
          },
        }),
      });

      if (!syncResponse.ok) {
        console.error(
          `[subscribe] ActiveCampaign contact/sync failed (${syncResponse.status}).`,
        );
        return false;
      }

      const synced: unknown = await syncResponse.json();
      const contactId = readContactId(synced);
      if (!contactId) {
        console.error(
          "[subscribe] ActiveCampaign contact/sync returned no contact id.",
        );
        return false;
      }

      const listResponse = await fetch(`${root}/api/3/contactLists`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contactList: {
            list: listId,
            contact: contactId,
            // 1 = subscribed. AC treats any other value as not-on-the-list.
            status: 1,
          },
        }),
      });

      if (!listResponse.ok) {
        console.error(
          `[subscribe] ActiveCampaign list subscribe failed (${listResponse.status}).`,
        );
        return false;
      }

      if (tagId) {
        // Best effort. The subscription already succeeded, so a failed tag is
        // logged and swallowed rather than shown to the reader as an error.
        const tagResponse = await fetch(`${root}/api/3/contactTags`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            contactTag: { contact: contactId, tag: tagId },
          }),
        });
        if (!tagResponse.ok) {
          console.error(
            `[subscribe] ActiveCampaign tag failed (${tagResponse.status}). Subscription itself succeeded.`,
          );
        }
      }

      return true;
    },
  };
}

/** Pulls `contact.id` out of an ActiveCampaign response without trusting it. */
function readContactId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const contact = (payload as { contact?: unknown }).contact;
  if (typeof contact !== "object" || contact === null) return null;
  const id = (contact as { id?: unknown }).id;
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof id === "number") return String(id);
  return null;
}

function resolveProvider(): Provider | null {
  const acUrl = process.env.ACTIVECAMPAIGN_API_URL;
  const acKey = process.env.ACTIVECAMPAIGN_API_KEY;
  const acList = process.env.ACTIVECAMPAIGN_LIST_ID;
  if (acUrl && acKey && acList) {
    return activeCampaign(acUrl, acKey, acList);
  }

  const webhook = process.env.SUBSCRIBE_WEBHOOK_URL;
  if (webhook) {
    return {
      name: "webhook",
      send: async (email, source) => {
        const response = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            source,
            publication: "entrepreneurship-collective",
            submitted_at: new Date().toISOString(),
          }),
        });
        return response.ok;
      },
    };
  }

  return null;
}

export async function subscribe(
  email: string,
  source: string,
): Promise<SubscribeOutcome> {
  const provider = resolveProvider();
  if (!provider) {
    console.error(
      "[subscribe] No newsletter provider configured. Set ACTIVECAMPAIGN_API_URL " +
        "+ ACTIVECAMPAIGN_API_KEY + ACTIVECAMPAIGN_LIST_ID, or SUBSCRIBE_WEBHOOK_URL.",
    );
    return { ok: false, reason: "unconfigured" };
  }

  try {
    const delivered = await provider.send(email, source);
    if (!delivered) {
      return { ok: false, reason: "provider" };
    }
    return { ok: true };
  } catch (error) {
    console.error(`[subscribe] ${provider.name} request failed.`, error);
    return { ok: false, reason: "provider" };
  }
}
