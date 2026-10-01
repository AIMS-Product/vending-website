"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { config } from "@/lib/config";
import {
  ATTRIBUTION_KEYS,
  GHL_LOCATION_ID,
  HONEYPOT_FIELD,
  MASTERCLASS_BUSY_MESSAGE,
  MASTERCLASS_CONFIRMED_PATH,
  NAME_PATTERN,
  masterclassPhase,
  registrationErrorCopy,
} from "@/lib/content/masterclass";
import {
  registerWebinarContact,
  webinarEventTag,
  WebinarRegistrationError,
} from "@/lib/ghl/webinar-registration";
import {
  reservePublicRateLimit,
  requestIp,
  type RateLimitReservation,
} from "@/lib/public-rate-limit";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_TTL_MS,
  signMasterclassSession,
} from "@/lib/masterclass-session";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

export type RegistrationState = {
  /** A non-error outcome shown in place of the redirect (stale event date). */
  notice?: string;
  errors?: Partial<
    Record<
      "firstName" | "lastName" | "email" | "phone" | "smsConsent" | "form",
      string
    >
  >;
  values?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    smsConsent: boolean;
  };
};

const NAME = NAME_PATTERN;
const NAME_MAX = "Use 40 characters or fewer";

const registration = z.object({
  // Names are merged into the confirmation SMS: letters only, so a form
  // cannot put a link in a text sent from our number.
  firstName: z
    .string()
    .trim()
    .min(1, "Enter your first name")
    .max(40, NAME_MAX)
    .regex(NAME, "Use letters only"),
  lastName: z
    .string()
    .trim()
    .max(40, NAME_MAX)
    .regex(/^$|^[\p{L}' -]+$/u, "Use letters only"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  // US and Canada only (99 of the last 100 GHL registrants), as E.164. No 555
  // area code and no N11 area code or exchange: they cannot take a text and
  // would spend SMS sends and rate-limit budget.
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""))
    .refine((v) => /^(?!555|[2-9]11)[2-9]\d{2}(?![2-9]11)[2-9]\d{6}$/.test(v), {
      error: "Enter a US or Canada mobile number",
    })
    .transform((v) => `+1${v}`),
  // The GHL form requires it (100 of the last 100 submissions carry it), and
  // the workflow texts every registrant.
  smsConsent: z.literal(true, { error: registrationErrorCopy.consent }),
  attribution: z.record(z.string(), z.string().max(500)),
});

const FIELD_KEYS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "smsConsent",
] as const;

/**
 * Registers a visitor for the next masterclass through GHL, which then runs the
 * same workflow as its own form. Fails closed: the confirmation page is shown
 * only once GHL has the contact and the trigger tag.
 */
export async function registerForMasterclass(
  _previous: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const text = (key: string) => String(formData.get(key) ?? "");
  const values = {
    firstName: text("firstName"),
    lastName: text("lastName"),
    email: text("email"),
    phone: text("phone"),
    smsConsent: formData.get("smsConsent") === "on",
  };
  const parsed = registration.safeParse({
    ...values,
    attribution: Object.fromEntries(
      ATTRIBUTION_KEYS.map((key) => [key, text(key)]).filter(([, v]) => v),
    ),
  });
  if (!parsed.success) {
    const errors: RegistrationState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = FIELD_KEYS.find((key) => key === issue.path[0]);
      if (field) errors[field] ??= issue.message;
    }
    return { errors, values };
  }

  // The ad attribution rides along, so the confirmation page can hand it on
  // to the Playbook checkout. Whitelisted and capped by the schema above.
  const next = new URLSearchParams({ first: parsed.data.firstName });
  for (const key of ATTRIBUTION_KEYS) {
    const value = parsed.data.attribution[key];
    if (value) next.set(key, value.slice(0, 200));
  }
  if (text(HONEYPOT_FIELD)) {
    // Logged so a real registrant dropped by an over-eager autofill shows up.
    console.warn("masterclass: honeypot tripped");
    redirect(`${MASTERCLASS_CONFIRMED_PATH}?${next}`);
  }

  // Drop any earlier registration's intake session up front: a failed attempt
  // must not leave this browser holding a previous contact's cookie. A
  // successful one replaces this with its own session below.
  const cookieStore = await cookies();
  cookieStore.delete({
    name: SESSION_COOKIE,
    path: SESSION_COOKIE_OPTIONS.path,
  });

  // Fail closed: every accepted registration texts a phone number, so a
  // limiter outage must not uncap it. Each budget is RESERVED first (row
  // inserted, then counted), so parallel submits can never all slip past a
  // check; a refused or failed registration refunds its email and phone rows
  // so a GHL outage never locks a real registrant out. The IP row is kept: it
  // throttles floods. The phone gets its own budget, so rotating emails and
  // IPs cannot keep texting one person.
  const ip = requestIp(await headers());
  const personReservations: RateLimitReservation[] = [];
  const refundPerson = () =>
    Promise.all(personReservations.map((r) => r.release()));
  const budgets = [
    ["masterclass_register_ip", { ip, email: null }, false],
    ["masterclass_register", { ip: null, email: parsed.data.email }, true],
    [
      "masterclass_register_phone",
      { ip: null, email: `phone:${parsed.data.phone}` },
      true,
    ],
  ] as const;
  for (const [action, subject, refundable] of budgets) {
    const reservation = await reservePublicRateLimit(action, subject);
    if (refundable) personReservations.push(reservation);
    if (!reservation.allowed) {
      await refundPerson();
      // Also refused when the limiter is down, so the copy never says "too many".
      return { errors: { form: MASTERCLASS_BUSY_MESSAGE }, values };
    }
  }

  if (!config.GHL_WRITE_TOKEN) {
    console.error(
      "masterclass: GHL_WRITE_TOKEN is not set; refusing to register",
    );
    await refundPerson();
    return { errors: { form: registrationErrorCopy.failed }, values };
  }

  const event = await getMasterclassEvent();
  // Past the live window the GHL date is last week's until the rollover writes
  // the next one: keep the lead, but never tag them into a finished room.
  const stale = masterclassPhase(Date.now(), event.startsAt) === "ended";
  if (stale) {
    console.warn("masterclass: event date is stale, registering untagged", {
      label: event.label,
      startsAt: event.startsAt,
    });
  }
  const eventTag = !stale && event.label ? webinarEventTag(event.label) : null;
  if (!eventTag && !stale) {
    console.warn(
      "masterclass: event tag unknown, repeat-registration check off",
    );
  }
  let contactId: string;
  let ownsContact: boolean;
  try {
    ({ contactId, ownsContact } = await registerWebinarContact(
      { ...parsed.data, eventTag },
      {
        token: config.GHL_WRITE_TOKEN,
        locationId: config.GHL_LOCATION_ID ?? GHL_LOCATION_ID,
      },
    ));
  } catch (error) {
    await refundPerson();
    console.error("masterclass: registration not saved", {
      step: error instanceof WebinarRegistrationError ? error.step : "unknown",
      status: error instanceof WebinarRegistrationError ? error.status : null,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { errors: { form: registrationErrorCopy.failed }, values };
  }

  // No confirmation page for a room that is over: say the next date is coming.
  if (stale) return { notice: registrationErrorCopy.nextDatePending };

  // Lets the confirmation page write intake answers to this contact. Optional:
  // without a session the page simply shows no intake form. Only issued for a
  // contact this request created or whose stored email AND phone both match,
  // so knowing a registrant's email never opens their intake.
  const session = ownsContact
    ? signMasterclassSession(contactId, config.MASTERCLASS_SESSION_SECRET)
    : null;
  if (!ownsContact) {
    console.warn(
      "masterclass: existing contact not verified, no intake session",
    );
  } else if (session) {
    cookieStore.set(SESSION_COOKIE, session, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: SESSION_TTL_MS / 1000,
    });
  } else {
    console.warn(
      "masterclass: no intake session (secret missing or short, or odd contact id)",
    );
  }

  redirect(`${MASTERCLASS_CONFIRMED_PATH}?${next}`);
}
