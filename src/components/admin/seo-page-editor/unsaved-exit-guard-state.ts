// N6 / issue I5: pure decision helpers for the unsaved-exit guard.
//
// The editor can be in one of three states when the user tries to leave:
//   1. No row yet     — a brand-new page where the user has not typed enough
//                        for S3b to auto-create a row. Nothing to delete; the
//                        round-1 beforeunload guard (S3a) still warns.
//   2. Auto-created    — S3b created a draft row once a title existed, but the
//      never saved      user has never explicitly saved (no Save draft, no
//                        publish). The URL was swapped via history.replaceState
//                        so the editor was NOT remounted with server `page`
//                        props. This is the orphan-draft case Discard targets.
//   3. Explicitly      — the row was loaded from the server (`page` prop set):
//      saved / loaded    the user clicked Save draft (which redirects and
//                        remounts), published, or opened an existing page.
//                        CORE INVARIANT: Discard must NEVER delete this row.
//
// The distinguishing client signal needs no controller change: the controller
// already exposes `page` (the SSR prop) and `effectivePageId` (which also
// reflects the S3b auto-created id). An auto-created-never-saved row is exactly
// "no server `page` row, but an effective id exists".

export type UnsavedExitGuardInput = {
  // `page?.id` from the loaded server props. Present only when the row was
  // loaded from the server, i.e. it was explicitly saved/published/opened.
  loadedPageId: string | null | undefined;
  // `effectivePageId` from the controller: `page?.id ?? createdDraftId`.
  effectivePageId: string | null | undefined;
  // True once the user has explicitly saved/published THIS session via the
  // editor form, even when no remount happened. Derived from the controller's
  // already-exposed `saveSeoPage` action state (`state.status === "saved"`)
  // and the `?saved=1` redirect flag. An explicit Save on an already
  // auto-created row does not redirect (no `?saved=1`, `page` stays undefined),
  // so without this flag the guard would wrongly keep offering Discard on a
  // row the user just chose to keep — violating the core invariant.
  explicitlySavedThisSession?: boolean;
};

// True only for state 2 above: a row exists, only because S3b auto-created it
// in this un-remounted session, AND the user has never explicitly saved it.
export function isAutoCreatedNeverSavedDraft({
  loadedPageId,
  effectivePageId,
  explicitlySavedThisSession = false,
}: UnsavedExitGuardInput): boolean {
  if (explicitlySavedThisSession) return false;
  return !loadedPageId && Boolean(effectivePageId);
}

// The id of the auto-created draft that Discard may delete, or null when there
// is nothing to discard (no row yet, or an explicitly-saved/loaded row).
export function discardableDraftId(
  input: UnsavedExitGuardInput,
): string | null {
  return isAutoCreatedNeverSavedDraft(input)
    ? (input.effectivePageId as string)
    : null;
}

// Server-side floor (defense in depth). Even though the client only OFFERS
// Discard for auto-created-never-saved rows, the delete action re-derives a
// hard safety floor from the row's own server state: a row is only deletable
// as a never-explicitly-saved auto-draft when it has never been published and
// has no revision history. A published page, or any page that has accumulated
// revisions, is rejected outright — that protects against a stale client,
// a spoofed id, or a future caller misusing the action.
export type NeverSavedRowState = {
  status: string;
  published_at: string | null;
  published_revision_id: string | null;
  revisionCount: number;
};

export function rowIsDeletableAsNeverSavedDraft(
  row: NeverSavedRowState,
): boolean {
  return (
    row.status === "draft" &&
    row.published_at === null &&
    row.published_revision_id === null &&
    row.revisionCount === 0
  );
}
