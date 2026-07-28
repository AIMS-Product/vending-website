/**
 * Idempotency helpers for the `close_sync_events` queue.
 *
 * `close_sync_events_dedupe_key_idx` is a unique index, so a dedupe key is the
 * only thing standing between a re-submit and a duplicate record in Close.
 */

/**
 * The key for "make sure this lead exists in Close".
 *
 * Keyed on the lead alone, deliberately. It used to include the qualification
 * session id, which broke the guarantee: a visitor who submitted the form twice
 * reused the same lead row but opened a second session, so the key differed, a
 * second push was queued, and the two pushes raced — Close created two contacts
 * for one person (reported 2026-07-28). One lead is one push, forever.
 */
export function leadCreateOrUpdateDedupeKey(leadSubmissionId: string): string {
  return `lead_create_or_update:${leadSubmissionId}`;
}

/**
 * True when an insert lost the race against the unique index. The work is
 * already queued, so callers should treat this as success rather than failing
 * the visitor's submit.
 */
export function isDuplicateDedupeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" ||
    String(record.message ?? "")
      .toLowerCase()
      .includes("duplicate")
  );
}
