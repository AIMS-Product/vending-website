import "server-only";

import { z } from "zod";

/**
 * A webinar registration from our own page, written into GHL so the SAME
 * workflow the GHL form feeds ("1. New Lead > Form Submission Webinar") runs
 * every downstream step unchanged: event tag, opportunity (-> Zoom + Close
 * zaps), `webinar-registrant` (-> Meta CAPI), confirmation SMS/email and the
 * sequences. That workflow has a second trigger, "tag added:
 * site-webinar-registration" (added 2026-09-30). Spec:
 * .claude/specs/2026-09-30-s1-site-registration.md.
 */

const BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";
const USER_AGENT =
  "vendingpreneurs-website/1.0 (+https://www.vendingpreneurs.com)";

export const SITE_REGISTRATION_TAG = "site-webinar-registration";
/** Contact source on create only; the opportunity step copies it. */
export const SITE_REGISTRATION_SOURCE = "Site Masterclass Registration";

/** The custom fields the GHL registration form writes (read live 2026-09-30). */
export const UTM_FIELD_IDS = {
  utm_source: "A5lto46gWq5GCV1gFAYV",
  utm_medium: "sTA2DpdX2T0hYmCK5QOK",
  utm_campaign: "aqH0AWiKM2AbQZ1jFkwK",
  utm_term: "q6085pCxGavjosxtkW8h",
  utm_content: "054iAlrjFHhqMU3AGUdn",
} as const;

/** vp-webinars `roll_next_event.label_for` month keys: "sept", "march". */
const TAG_MONTHS: Record<string, string> = {
  january: "jan",
  february: "feb",
  march: "march",
  april: "april",
  may: "may",
  june: "june",
  july: "july",
  august: "aug",
  september: "sept",
  october: "oct",
  november: "nov",
  december: "dec",
};

/**
 * "October 6, 2026 at 7:30 PM CDT" -> "webinar-oct6", the tag the workflow
 * adds for that room. Used only to recognise someone already registered, so a
 * wrong guess costs a duplicate confirmation, never a lost registration.
 */
export function webinarEventTag(label: string): string | null {
  const match = /([A-Za-z]+)\s+(\d{1,2}),/.exec(label);
  const month = match && TAG_MONTHS[match[1].toLowerCase()];
  return month ? `webinar-${month}${Number(match[2])}` : null;
}

export type WebinarRegistration = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  attribution: Record<string, string>;
  /** This room's GHL tag, or null when the date could not be read. */
  eventTag: string | null;
};

export type WebinarRegistrationStep =
  | "lookup"
  | "upsert"
  | "remove-tag"
  | "add-tag";

export class WebinarRegistrationError extends Error {
  constructor(
    readonly step: WebinarRegistrationStep,
    readonly status: number,
  ) {
    super(`GHL webinar registration failed at ${step} (${status})`);
    this.name = "WebinarRegistrationError";
  }
}

/** "SMS Consent Marketing" (TEXT). The GHL form keeps consent on the submission only. */
export const SMS_CONSENT_FIELD_ID = "7UnFD4LUSeTwW9QlVrqh";

const TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 500;

const contactShape = z.object({
  id: z.string().min(1),
  tags: z.array(z.string()).nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  phone: z.string().nullish(),
});
const duplicateResponse = z.object({ contact: contactShape.nullish() });
const upsertResponse = z.object({ contact: contactShape });

type Options = {
  token: string;
  locationId: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
};

/** A leading = + - @ makes a spreadsheet cell a formula (the zap writes a Sheet row). */
const cell = (value: string) => value.trim().replace(/^[=+\-@\s]+/, "");

export async function registerWebinarContact(
  person: WebinarRegistration,
  {
    token,
    locationId,
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = () => new Date(),
  }: Options,
): Promise<"registered" | "already-registered"> {
  const call = async (
    step: WebinarRegistrationStep,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> => {
    // One retry for a network error, timeout, 429 or 5xx; a 4xx is a refusal.
    for (let attempt = 1; ; attempt++) {
      let response: Response | null = null;
      try {
        response = await fetchImpl(`${BASE_URL}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Version: API_VERSION,
            Accept: "application/json",
            "Content-Type": "application/json",
            // Cloudflare answers 1010 to a request with no real User-Agent.
            "User-Agent": USER_AGENT,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        console.warn("ghl webinar registration: request failed", {
          step,
          attempt,
          name: error instanceof Error ? error.name : "UnknownError",
        });
      }
      const status = response?.status ?? 0;
      if (response?.ok) {
        // Parsed outside the retry: a 2xx already wrote, so never resend it.
        const text = await response.text();
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          throw new WebinarRegistrationError(step, status);
        }
      }
      await response?.body?.cancel();
      const transient = status === 0 || status === 429 || status >= 500;
      if (!transient || attempt >= 2) {
        throw new WebinarRegistrationError(step, status);
      }
      await sleep(RETRY_DELAY_MS);
    }
  };

  const found = duplicateResponse.safeParse(
    await call(
      "lookup",
      "GET",
      `/contacts/search/duplicate?${new URLSearchParams({ locationId, email: person.email })}`,
    ),
  );
  if (!found.success) throw new WebinarRegistrationError("lookup", 200);
  const existing = found.data.contact;
  if (person.eventTag && existing?.tags?.includes(person.eventTag)) {
    return "already-registered";
  }

  // A public form must not rewrite a known contact: someone who knows a lead's
  // email could otherwise swap in their own phone and receive the texts. An
  // existing contact only gains fields it is missing.
  const blank = (value: string | null | undefined) => !value?.trim();
  const profile = {
    firstName: cell(person.firstName),
    lastName: cell(person.lastName),
    phone: person.phone,
  };
  const fields = Object.fromEntries(
    Object.entries(profile).filter(
      ([key, value]) =>
        value && (!existing || blank(existing[key as keyof typeof profile])),
    ),
  );
  const customFields = [
    ...Object.entries(UTM_FIELD_IDS).flatMap(([key, id]) => {
      const value = cell(person.attribution[key] ?? "");
      return value ? [{ id, field_value: value }] : [];
    }),
    {
      id: SMS_CONSENT_FIELD_ID,
      field_value: `Yes, vendingpreneurs.com/masterclass ${now().toISOString()}`,
    },
  ];
  const saved = upsertResponse.safeParse(
    await call("upsert", "POST", "/contacts/upsert", {
      locationId,
      email: person.email,
      ...fields,
      ...(existing ? {} : { source: SITE_REGISTRATION_SOURCE }),
      customFields,
    }),
  );
  if (!saved.success) throw new WebinarRegistrationError("upsert", 200);
  const contact = saved.data.contact;
  // The upsert follows the location's duplicate rules; it must land on the
  // contact the email lookup found, or the checks above judged someone else.
  if (existing && existing.id !== contact.id) {
    throw new WebinarRegistrationError("upsert", 409);
  }

  const tagPath = `/contacts/${encodeURIComponent(contact.id)}/tags`;
  const tagBody = { tags: [SITE_REGISTRATION_TAG] };
  // "Tag added" never fires for a tag already present (last week's), and the
  // upsert answer's tag list cannot be trusted to say, so always remove first.
  // Removing a tag the contact lacks is a no-op.
  await call("remove-tag", "DELETE", tagPath, tagBody);
  await call("add-tag", "POST", tagPath, tagBody);
  return "registered";
}
