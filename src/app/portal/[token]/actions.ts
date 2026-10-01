"use server";

import { z } from "zod";

const intakeSchema = z.object({
  token: z.string().min(1).max(200),
  occupation: z.string().trim().max(120).optional(),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Enter a 5-digit ZIP code.")
    .optional()
    .or(z.literal("")),
  goal: z.string().trim().max(300).optional(),
});

export type IntakeState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

/**
 * PRD §8 `intake.submitted`. Validates at the boundary, then hands off.
 *
 * Dom: replace the not-connected branch with the SteelTrap write (persist the
 * three fields by token, kick off VendScout + research GPT for the ZIP), then
 * `revalidatePath(`/portal/${token}`)` so the page re-personalizes.
 */
export async function submitPortalIntake(
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const parsed = intakeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Check your answers and try again.",
    };
  }
  if (parsed.data.token.startsWith("demo")) {
    return { status: "saved", message: "Demo page: answers are not saved." };
  }
  console.error("portal intake: SteelTrap write not connected", {
    token: parsed.data.token,
  });
  return {
    status: "error",
    message:
      "We couldn't save that just now. Your advisor will ask on the call.",
  };
}
