import type { PublicLeadActionState } from "@/app/lead-action-state";

export type LeadErrorSummaryItem = {
  // The camelCase key the server uses in fieldErrors (e.g. "fullName").
  errorKey: string;
  // The visible field label, e.g. "Name".
  label: string;
  // The id of the input the anchor should focus, e.g. "lead-full_name".
  inputId: string;
};

// Source of truth for mapping a server fieldErrors key to the form field's
// visible label and input id. Order here is the order failed fields are
// listed in the summary, so it tracks the visual top-to-bottom field order.
const FIELD_DESCRIPTORS: ReadonlyArray<{
  errorKey: string;
  name: string;
  label: string;
}> = [
  { errorKey: "fullName", name: "full_name", label: "Name" },
  { errorKey: "email", name: "email", label: "Email" },
  { errorKey: "phone", name: "phone", label: "Phone" },
  { errorKey: "city", name: "city", label: "City" },
  { errorKey: "stateRegion", name: "state_region", label: "State" },
  {
    errorKey: "businessStage",
    name: "business_stage",
    label: "Business stage",
  },
  { errorKey: "budget", name: "budget", label: "Available startup budget" },
  { errorKey: "timeline", name: "timeline", label: "Launch timeline" },
  { errorKey: "message", name: "message", label: "Message" },
];

/**
 * Derives the ordered list of failed fields to show in the error summary
 * from an action state. Returns an empty array unless the state is an error
 * carrying field-level errors. Pure so it can be unit-tested without a DOM;
 * the focus-on-activate behavior of the anchors is exercised by the browser
 * gate.
 */
export function deriveLeadErrorSummary(
  state: PublicLeadActionState,
): LeadErrorSummaryItem[] {
  if (state.status !== "error" || !state.fieldErrors) return [];
  const fieldErrors = state.fieldErrors;
  return FIELD_DESCRIPTORS.filter(
    (descriptor) => (fieldErrors[descriptor.errorKey]?.length ?? 0) > 0,
  ).map((descriptor) => ({
    errorKey: descriptor.errorKey,
    label: descriptor.label,
    inputId: `lead-${descriptor.name}`,
  }));
}
