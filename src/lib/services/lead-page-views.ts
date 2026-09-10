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
/**
 * Ceiling on every stored UTM.
 *
 * These arrive in the JSON body of the public, unauthenticated
 * POST /api/attribution/events, whose zod schema puts no length bound on a
 * property value. `utm_campaign` is incidentally protected by its btree index;
 * the other two were stored with only a trim. A follow-up migration adds
 * matching CHECK constraints so no future caller can bypass this.
 */
const MAX_UTM_LENGTH = 200;

function cap(value: string | null | undefined): string | null {
  return value?.trim().slice(0, MAX_UTM_LENGTH) || null;
}

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
          utm_source: cap(utmSource),
          utm_campaign: campaign.slice(0, MAX_UTM_LENGTH),
          utm_content: cap(utmContent),
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
