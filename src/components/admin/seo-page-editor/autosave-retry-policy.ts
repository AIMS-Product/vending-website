// Backoff policy for autosave retries. After a failed autosave we retry on this
// schedule (ms between attempts) so a transient network blip recovers on its
// own — but we CAP the attempts so a persistent failure rests instead of
// hammering the server (the "retry storm" unsafe outcome). After the cap we
// stop and wait for the next edit or a manual save to re-arm.

export const AUTOSAVE_RETRY_BACKOFF_MS = [2000, 5000, 10000] as const;

// Total automatic attempts after the first failure == backoff schedule length.
export const AUTOSAVE_MAX_RETRIES = AUTOSAVE_RETRY_BACKOFF_MS.length;

// Given how many retries have already been made, return the delay before the
// next one, or null when the cap is reached (stop retrying — rest).
export function nextAutosaveRetryDelayMs(retriesSoFar: number): number | null {
  if (retriesSoFar < 0) return AUTOSAVE_RETRY_BACKOFF_MS[0];
  if (retriesSoFar >= AUTOSAVE_MAX_RETRIES) return null;
  return AUTOSAVE_RETRY_BACKOFF_MS[retriesSoFar];
}

export type AutosaveFailureMode = "retrying" | "exhausted";

// Whether the editor should keep auto-retrying, or has exhausted its budget and
// must wait for a manual save / new edit.
export function autosaveFailureMode(retriesSoFar: number): AutosaveFailureMode {
  return retriesSoFar >= AUTOSAVE_MAX_RETRIES ? "exhausted" : "retrying";
}

// User-facing message for the save indicator's error state. Both branches make
// clear the work is NOT saved (the data-loss-lie this fixes) and offer the
// manual fallback.
export function autosaveFailureMessage(mode: AutosaveFailureMode): string {
  return mode === "retrying"
    ? "Couldn't save — retrying. Save manually if it persists."
    : "Couldn't save automatically. Save manually with Save draft to keep your work.";
}
