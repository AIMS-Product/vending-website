import "server-only";

/**
 * Where a signup actually goes.
 *
 * The page ships before the email platform is picked, so this is an adapter
 * with three supported backends. The first one that is fully configured wins:
 *
 *   1. beehiiv        BEEHIIV_API_KEY + BEEHIIV_PUBLICATION_ID
 *   2. Kit/ConvertKit KIT_API_KEY + KIT_FORM_ID
 *   3. Webhook        SUBSCRIBE_WEBHOOK_URL  (Zapier, Make, n8n, a CRM…)
 *
 * With none of them set the form reports an explicit "not connected yet"
 * error rather than showing a success screen it can't honour. A subscriber
 * who is told they're in and then never hears from us is worse than a
 * visible error on a page nobody has pointed a domain at yet.
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

function resolveProvider(): Provider | null {
  const beehiivKey = process.env.BEEHIIV_API_KEY;
  const beehiivPublication = process.env.BEEHIIV_PUBLICATION_ID;
  if (beehiivKey && beehiivPublication) {
    return {
      name: "beehiiv",
      send: async (email, source) => {
        const response = await fetch(
          `https://api.beehiiv.com/v2/publications/${beehiivPublication}/subscriptions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${beehiivKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              reactivate_existing: true,
              send_welcome_email: true,
              utm_source: source,
            }),
          },
        );
        return response.ok;
      },
    };
  }

  const kitKey = process.env.KIT_API_KEY;
  const kitForm = process.env.KIT_FORM_ID;
  if (kitKey && kitForm) {
    return {
      name: "kit",
      send: async (email, source) => {
        const response = await fetch(
          `https://api.kit.com/v4/forms/${kitForm}/subscribers`,
          {
            method: "POST",
            headers: {
              "X-Kit-Api-Key": kitKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email_address: email,
              fields: { source },
            }),
          },
        );
        return response.ok;
      },
    };
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
      "[subscribe] No newsletter provider configured. Set BEEHIIV_API_KEY + " +
        "BEEHIIV_PUBLICATION_ID, KIT_API_KEY + KIT_FORM_ID, or SUBSCRIBE_WEBHOOK_URL.",
    );
    return { ok: false, reason: "unconfigured" };
  }

  try {
    const delivered = await provider.send(email, source);
    if (!delivered) {
      console.error(`[subscribe] ${provider.name} rejected the signup.`);
      return { ok: false, reason: "provider" };
    }
    return { ok: true };
  } catch (error) {
    console.error(`[subscribe] ${provider.name} request failed.`, error);
    return { ok: false, reason: "provider" };
  }
}
