import posthog, { type CaptureOptions, type Properties } from "posthog-js";

/**
 * The only place the app talks to posthog-js. Init lives in
 * `src/instrumentation-client.ts`; everything else goes through `captureEvent`
 * so PostHog being off (no NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN), not yet loaded, or absent
 * on the server is a silent no-op rather than a crash in a form handler.
 */
export function posthogReady(): boolean {
  return typeof window !== "undefined" && posthog.__loaded === true;
}

export function captureEvent(
  event: string,
  properties?: Properties,
  options?: CaptureOptions,
) {
  if (!posthogReady()) return;
  try {
    posthog.capture(event, properties, options);
  } catch {
    // Analytics is best-effort; a capture failure must never break the page.
  }
}

/**
 * For events raced against navigation or unload (form abandonment, the
 * Calendly redirect): skips the batch queue and uses sendBeacon so the request
 * survives the page going away.
 */
export const SEND_NOW: CaptureOptions = {
  send_instantly: true,
  transport: "sendBeacon",
};
