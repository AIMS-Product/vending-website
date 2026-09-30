"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ATTRIBUTION_KEYS,
  MASTERCLASS_CONFIRMED_PATH,
} from "@/lib/content/masterclass";

export type RegistrationState = {
  errors?: Partial<Record<"firstName" | "email" | "phone" | "form", string>>;
  values?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
};

const registration = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v.replace(/\D/g, "").length >= 10,
      "Enter a valid phone number",
    ),
  smsConsent: z.boolean(),
  attribution: z.record(z.string(), z.string()),
});

/**
 * Registration for the site-built masterclass page.
 *
 * ponytail: preview only. It validates and moves the visitor to the
 * confirmation page, but writes nothing to GHL yet. The GHL pages feed a Zapier
 * zap (Zoom registration, Close, the Sheet) and a Meta CAPI workflow whose
 * triggers are not visible through the API. The write goes in once Ivan
 * confirms the trigger, so a site registration fires exactly what a GHL one
 * does. Until then the page must not take paid traffic.
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
  };
  const parsed = registration.safeParse({
    ...values,
    smsConsent: formData.get("smsConsent") === "on",
    attribution: Object.fromEntries(
      ATTRIBUTION_KEYS.map((key) => [key, text(key)]).filter(([, v]) => v),
    ),
  });
  if (!parsed.success) {
    const errors: RegistrationState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "firstName" || field === "email" || field === "phone") {
        errors[field] ??= issue.message;
      }
    }
    return { errors, values };
  }
  const next = new URLSearchParams({ first: parsed.data.firstName });
  redirect(`${MASTERCLASS_CONFIRMED_PATH}?${next}`);
}
