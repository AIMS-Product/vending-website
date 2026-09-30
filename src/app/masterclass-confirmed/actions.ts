"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { config } from "@/lib/config";
import { intakeCopy } from "@/lib/content/masterclass";
import {
  saveWebinarIntake,
  WebinarRegistrationError,
  type WebinarIntake,
} from "@/lib/ghl/webinar-registration";
import {
  SESSION_COOKIE,
  verifyMasterclassSession,
} from "@/lib/masterclass-session";
import {
  checkPublicRateLimit,
  TOO_MANY_REQUESTS_MESSAGE,
} from "@/lib/public-rate-limit";

type Key = keyof WebinarIntake;

export type IntakeState = {
  saved?: true;
  errors?: Partial<Record<Key | "form", string>>;
  values?: Partial<WebinarIntake>;
};

const [situation, timeline, income] = intakeCopy.questions;
const answer = (options: readonly [string, ...string[]]) =>
  z.enum(options, { error: intakeCopy.required });
/** Only the exact GHL picklist text passes: GHL would store anything else. */
const intake = z.object({
  situation: answer(situation.options),
  timeline: answer(timeline.options),
  income: answer(income.options),
});

/**
 * Writes the confirmation page's intake answers onto the GHL contact that just
 * registered, named by the signed `mc_session` cookie. Spec: S1b in
 * .claude/specs/2026-09-30-s1-site-registration.md.
 */
export async function saveMasterclassIntake(
  _previous: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const values = Object.fromEntries(
    (["situation", "timeline", "income"] as const).map((key) => [
      key,
      String(formData.get(key) ?? ""),
    ]),
  ) as WebinarIntake;
  const parsed = intake.safeParse(values);
  if (!parsed.success) {
    const errors: IntakeState["errors"] = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as Key] ??= issue.message;
    }
    return { errors, values };
  }

  const contactId = verifyMasterclassSession(
    (await cookies()).get(SESSION_COOKIE)?.value,
    config.MASTERCLASS_SESSION_SECRET,
  );
  if (!contactId) return { errors: { form: intakeCopy.expired }, values };

  // Per contact, not per IP: only a signed cookie gets here, and a carrier IP
  // (CGNAT) is shared by many registrants. Fail closed: a limiter outage must
  // not uncap writes into the CRM.
  const allowed = await checkPublicRateLimit(
    "masterclass_intake",
    { ip: null, email: `contact:${contactId}` },
    { failClosed: true },
  );
  if (!allowed) return { errors: { form: TOO_MANY_REQUESTS_MESSAGE }, values };

  if (!config.GHL_WRITE_TOKEN) {
    console.error("masterclass intake: GHL_WRITE_TOKEN is not set");
    return { errors: { form: intakeCopy.failed }, values };
  }
  try {
    await saveWebinarIntake(contactId, parsed.data, {
      token: config.GHL_WRITE_TOKEN,
    });
  } catch (error) {
    console.error("masterclass intake: answers not saved", {
      status: error instanceof WebinarRegistrationError ? error.status : null,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { errors: { form: intakeCopy.failed }, values };
  }
  return { saved: true, values: parsed.data };
}
