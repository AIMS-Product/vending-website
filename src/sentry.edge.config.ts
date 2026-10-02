import * as Sentry from "@sentry/nextjs";
import { sentryPiiHooks } from "@/lib/tracking/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Ties each error to the deployed commit (also set at build by the Sentry
    // plugin; explicit here so it never depends on source-map upload).
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    // Strips email/phone/name params from URLs in breadcrumbs, requests, spans.
    ...sentryPiiHooks,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}
