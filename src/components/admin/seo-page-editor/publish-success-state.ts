import type { PageEditorActionState } from "@/app/admin/pages/actions";

// A manual publish that has just completed successfully. Drives the success
// block and the dismissal of the confirm card. Derived from the same signals
// the controller already tracks — no new server state.
export function isPublishJustSucceeded({
  stateStatus,
  lastManualSubmitIntent,
}: {
  stateStatus: PageEditorActionState["status"];
  lastManualSubmitIntent: "save" | "publish";
}): boolean {
  return stateStatus === "saved" && lastManualSubmitIntent === "publish";
}
