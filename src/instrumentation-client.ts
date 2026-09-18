import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import {
  readStoredAttributionSession,
  refreshStoredSession,
} from "@/lib/attribution-client";
import { eventContext } from "@/lib/tracking/event-context";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

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
      // Nobody is identified: visitors stay anonymous in PostHog and join to
      // our tables on the vp_session_id property, not on a person profile.
      person_profiles: "identified_only",
      capture_dead_clicks: true,
      before_send: (event) => {
        if (!event || event.event === "$snapshot") return event;
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
