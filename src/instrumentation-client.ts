import type * as SentryNs from "@sentry/nextjs";
import { sentryPiiHooks } from "@/lib/tracking/sentry-scrub";
import posthog from "posthog-js";
import {
  readStoredAttributionSession,
  refreshStoredSession,
} from "@/lib/attribution-client";
import { eventContext } from "@/lib/tracking/event-context";
import {
  POSTHOG_PII_PARAMS,
  scrubPostHogEvent,
} from "@/lib/tracking/posthog-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Sentry's browser SDK (tracing included) is ~100 KB gzipped of main-thread
// parse work. It is loaded after the page is idle so it never competes with
// hydration; errors thrown in the first moments of a page load are not
// captured (accepted trade-off, measured TBT win).
let sentry: typeof SentryNs | null = null;

if (dsn) {
  const bootSentry = () => {
    import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.init({
          dsn,
          environment: process.env.NODE_ENV,
          sendDefaultPii: false,
          // Strips email/phone/name params from URLs in breadcrumbs, requests, spans.
          ...sentryPiiHooks,
          tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
        });
        sentry = Sentry;
      })
      .catch((error: unknown) => {
        console.warn("Sentry failed to load", error);
      });
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(bootSentry, { timeout: 4000 });
  } else {
    setTimeout(bootSentry, 2000);
  }
}

export const onRouterTransitionStart = (
  ...args: Parameters<typeof SentryNs.captureRouterTransitionStart>
) => sentry?.captureRouterTransitionStart(...args);

/**
 * PostHog boot. Runs before hydration on every full page load (Next.js
 * `instrumentation-client` convention), so the first `$pageview` is captured
 * here, not in a component.
 *
 * PostHog owns the pre-submit behaviour layer only: pageviews, scroll depth,
 * clicks, rage/dead clicks, replays, and the form_* events. Leads, bookings,
 * shows and revenue stay in Supabase/Close (see .claude/specs/2026-09-18-
 * posthog-conversion-tracking.md). The seam is `vp_session_id`, which
 * `before_send` stamps on every event.
 *
 * Off when NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is unset (local dev, previews without the
 * var) and on /admin. Traffic goes through the same-origin reverse proxy at
 * /api/ph (next.config.ts rewrites) so ad blockers and the CSP see our own
 * origin.
 */
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const environment = process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development";

if (posthogKey && !window.location.pathname.startsWith("/admin")) {
  try {
    // The first-party session has to exist before PostHog captures anything,
    // or the very first pageview of a new visitor has no vp_session_id.
    refreshStoredSession();

    posthog.init(posthogKey, {
      api_host: `${window.location.origin}/api/ph`,
      ui_host: "https://us.posthog.com",
      defaults: "2026-08-30",
      // No PostHog surveys are used; skips the 28 KB surveys.js bundle.
      disable_surveys: true,
      // Nobody is identified: visitors stay anonymous in PostHog and join to
      // our tables on the vp_session_id property, not on a person profile.
      person_profiles: "identified_only",
      capture_dead_clicks: true,
      // Belt and braces with before_send: also mask these params natively.
      mask_personal_data_properties: true,
      custom_personal_data_properties: POSTHOG_PII_PARAMS,
      // Not stripped from the address bar before init: Next's router adopts
      // the URL at hydration and StripPiiParams already strips it safely
      // afterwards (no page reads these params client-side). before_send
      // scrubs every property, including the first $pageview, so nothing
      // PII-bearing leaves the browser either way.
      before_send: (raw) => {
        if (!raw) return raw;
        const event = scrubPostHogEvent(raw);
        if (event.event === "$snapshot") return event;
        const current = event.properties.$current_url;
        const url = new URL(
          typeof current === "string" ? current : window.location.href,
        );
        event.properties = {
          ...event.properties,
          ...eventContext({
            url,
            session: readStoredAttributionSession(),
            environment,
            existing: event.properties,
          }),
        };
        return event;
      },
    });
  } catch {
    // Analytics must never take a page down.
  }
}
