"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifiedCookieName } from "@/lib/portal/get-portal-data";

// Every portal write goes through here. Each validates at the boundary and
// handles the `demo*` tokens locally; a real token returns a not-connected
// error until SteelTrap implements the write (see docs/client-portal/HANDOFF.md).

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };

const token = z.string().min(1).max(200);
const isDemo = (value: string) => value.startsWith("demo");
const notConnected = (what: string, t: string): ActionState => {
  console.error(`portal: ${what} not connected`, { tokenLength: t.length });
  return {
    status: "error",
    message: "We couldn't save that just now. Please try again later.",
  };
};

/** Arch doc `intake.submitted`: occupation, ZIP, goal. */
const intakeSchema = z.object({
  token,
  occupation: z.string().trim().max(120).optional(),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Enter a 5-digit ZIP code.")
    .optional()
    .or(z.literal("")),
  goal: z.string().trim().max(300).optional(),
});

export async function submitIntake(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = intakeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { status: "error", message: parsed.error.issues[0]?.message };
  if (isDemo(parsed.data.token))
    return {
      status: "ok",
      message: "Thanks. (Demo page: answers aren't saved.)",
    };
  return notConnected("intake", parsed.data.token);
}

/** Arch doc `portal_step_state`: a prospect ticked or unticked a step. */
const stepSchema = z.object({
  token,
  stepKey: z.string().min(1).max(80),
  done: z.boolean(),
});

export async function setStepDone(
  input: z.infer<typeof stepSchema>,
): Promise<ActionState> {
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid step." };
  if (isDemo(parsed.data.token)) return { status: "ok" };
  return notConnected("step state", parsed.data.token);
}

/** Arch doc §5.3: verify the email bound to this link before private material. */
const verifySchema = z.object({
  token,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function verifyEmail(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = verifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { status: "error", message: parsed.error.issues[0]?.message };
  if (!isDemo(parsed.data.token))
    return notConnected("email verification", parsed.data.token);
  // Demo: any 6 digits verifies. Real: check a one-time code sent to the bound email.
  const store = await cookies();
  store.set(verifiedCookieName(parsed.data.token), "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: `/portal/${parsed.data.token}`,
    maxAge: 60 * 60 * 24,
  });
  revalidatePath(`/portal/${parsed.data.token}`);
  return { status: "ok" };
}

/** Arch doc `portal_question`: goes to the assigned rep (AI answers are a later phase). */
const questionSchema = z.object({
  token,
  question: z.string().trim().min(3, "Type your question.").max(1000),
});

export async function askQuestion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = questionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { status: "error", message: parsed.error.issues[0]?.message };
  if (isDemo(parsed.data.token))
    return {
      status: "ok",
      message: "Sent. You'll get the answer here and by email.",
    };
  return notConnected("question", parsed.data.token);
}
