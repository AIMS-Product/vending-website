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
  registrationErrorCopy,
} from "@/lib/content/masterclass";
import {
  registerWebinarContact,
  webinarEventTag,
  WebinarRegistrationError,
} from "@/lib/ghl/webinar-registration";
import { checkPublicRateLimit, requestIp } from "@/lib/public-rate-limit";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_TTL_MS,
  signMasterclassSession,
} from "@/lib/masterclass-session";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";

export type RegistrationState = {
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
  // US and Canada only (99 of the last 100 GHL registrants), as E.164.
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""))
    .refine((v) => /^[2-9]\d{2}[2-9]\d{6}$/.test(v), {
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
  // limiter outage must not uncap it. The phone gets its own budget, so
  // rotating emails and IPs cannot keep texting one person.
  const ip = requestIp(await headers());
  const checks = [
    { action: "masterclass_register_ip", ip, email: null },
    { action: "masterclass_register", ip: null, email: parsed.data.email },
    {
      action: "masterclass_register_phone",
      ip: null,
      email: `phone:${parsed.data.phone}`,
    },
  ] as const;
  let allowed = true;
  for (const { action, ...subject } of checks) {
    allowed = await checkPublicRateLimit(action, subject, { failClosed: true });
    if (!allowed) break;
  }
  // Also false when the limiter is down, so the copy never says "too many".
  if (!allowed) return { errors: { form: MASTERCLASS_BUSY_MESSAGE }, values };

  if (!config.GHL_WRITE_TOKEN) {
    console.error(
      "masterclass: GHL_WRITE_TOKEN is not set; refusing to register",
    );
    return { errors: { form: registrationErrorCopy.failed }, values };
  }

  const event = await getMasterclassEvent();
  const eventTag = event.label ? webinarEventTag(event.label) : null;
  if (!eventTag) {
    console.warn(
      "masterclass: event tag unknown, repeat-registration check off",
    );
  }
  let contactId: string;
  try {
    ({ contactId } = await registerWebinarContact(
      { ...parsed.data, eventTag },
      {
        token: config.GHL_WRITE_TOKEN,
        locationId: config.GHL_LOCATION_ID ?? GHL_LOCATION_ID,
      },
    ));
  } catch (error) {
    console.error("masterclass: registration not saved", {
      step: error instanceof WebinarRegistrationError ? error.step : "unknown",
      status: error instanceof WebinarRegistrationError ? error.status : null,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { errors: { form: registrationErrorCopy.failed }, values };
  }

  // Lets the confirmation page write intake answers to this contact. Optional:
  // without the secret the page simply shows no intake form.
  const session = signMasterclassSession(
    contactId,
    config.MASTERCLASS_SESSION_SECRET,
  );
  if (session) {
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
