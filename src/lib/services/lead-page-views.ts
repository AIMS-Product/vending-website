import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records one tagged landing-page visit.
 *
 * Fed by the `landing_viewed` attribution event, which already fires on every
 * page and already carries the session's UTMs — this stage of the funnel needed
 * no new client code, only somewhere to put what was being thrown away.
 *
 * Deliberately narrow: a view with no campaign is not stored. Untagged
 * pageviews cannot be attributed to a video, and keeping them would turn a
 * focused attribution table into general web analytics that nobody asked for
 * and that Vercel Analytics already provides.
 *
 * Best-effort by contract. It never throws and never blocks the event
 * forward, so a missing table (before the migration is applied) or a duplicate
 * within the same session-day is a no-op rather than a failed request.
 */
export async function recordTaggedPageView({
  path,
  vpSessionId,
  utmSource,
  utmCampaign,
  utmContent,
  occurredAt,
}: {
  path: string;
  vpSessionId: string;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  occurredAt?: Date;
}): Promise<void> {
  const campaign = utmCampaign?.trim();
  if (!campaign || !path.trim() || !vpSessionId.trim()) return;

  const at = occurredAt ?? new Date();

  try {
    await createAdminClient()
      .from("lead_page_views")
      .upsert(
        {
          path: path.trim().slice(0, 300),
          vp_session_id: vpSessionId.trim().slice(0, 160),
          utm_source: utmSource?.trim() || null,
          utm_campaign: campaign,
          utm_content: utmContent?.trim() || null,
          occurred_on: at.toISOString().slice(0, 10),
          occurred_at: at.toISOString(),
        },
        {
          // One visit per session, per path, per day — see the unique index.
          // A reload is the same visit, not a second one.
          onConflict: "vp_session_id,path,occurred_on",
          ignoreDuplicates: true,
        },
      );
  } catch {
    // Attribution is reporting, not the product. A failure here must never
    // surface to a visitor.
  }
}
