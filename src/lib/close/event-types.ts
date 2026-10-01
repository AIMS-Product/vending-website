/**
 * Outbox event types that do not touch Close, so their outcome is not the
 * lead's Close sync state: the drain does not write it back, an admin retry
 * does not reset it, and the leads list does not pick them as "latest event".
 */
export const NON_CLOSE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "warm_reply_activity",
  "ghl_forward",
  "kit_subscribe",
]);
