export type PublicLeadActionState =
  | { status: "idle"; message?: string; fieldErrors?: Record<string, string[]> }
  | {
      status: "success";
      message: string;
      leadId: string;
      redirectHref?: string;
    }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export const initialLeadActionState: PublicLeadActionState = {
  status: "idle",
};

export type LeadIntent = "apply" | "contact" | "qualification";

export const APPLY_THANK_YOU_PATH = "/thank-you-for-applying";

export type LeadSuccessTransition =
  | { kind: "redirect"; href: string }
  | { kind: "panel"; email: string }
  | null;

/**
 * Decides what the form should do after a successful submission. Apply
 * leads navigate to the dedicated thank-you page; contact leads swap the
 * form for an in-place success panel. Pure so it can be unit-tested
 * without a DOM, and so the server action's error contract stays intact.
 */
export function resolveLeadSuccessTransition(
  state: PublicLeadActionState,
  intent: LeadIntent,
  submittedEmail: string,
): LeadSuccessTransition {
  if (state.status !== "success") return null;
  if (state.redirectHref) {
    return { kind: "redirect", href: state.redirectHref };
  }
  if (intent === "apply") {
    return { kind: "redirect", href: APPLY_THANK_YOU_PATH };
  }
  if (intent === "qualification") return null;
  return { kind: "panel", email: submittedEmail.trim() };
}
