/**
 * Who Calendly assigned. Webhook payloads carry it at
 * `scheduled_event.event_memberships[].user_name`; the embed route stores the
 * scheduled event under the same key. Anything else is null, never a guess.
 */
export function hostNameFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const event = (record.scheduled_event ??
    (record.payload as Record<string, unknown> | undefined)
      ?.scheduled_event) as Record<string, unknown> | undefined;
  const memberships = event?.event_memberships;
  if (!Array.isArray(memberships)) return null;
  const names = memberships
    .map((m) =>
      m && typeof m === "object"
        ? (m as { user_name?: unknown }).user_name
        : null,
    )
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  return names.length ? names.join(", ") : null;
}
