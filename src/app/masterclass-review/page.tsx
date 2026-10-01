import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../home-v2.css";
import { ReviewGuide } from "@/components/sections/masterclass/ReviewGuide";
import { getAuthorizedAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Team review | Webinar funnel",
  description: "Internal review of the rebuilt webinar funnel",
  robots: { index: false, follow: false },
};

// Per request: the session decides whether this page exists at all.
export const dynamic = "force-dynamic";

/**
 * Internal briefing (conflicting member figures, process notes). The proxy's
 * /admin gate does not cover this path, so the page gates itself: signed in
 * and on the `app_users` allowlist (any role, so the shared team login can
 * read it), otherwise a plain 404 that does not reveal the route exists.
 */
export default async function MasterclassReviewPage() {
  const admin = await getAuthorizedAdmin();
  if (!admin) notFound();
  return <ReviewGuide />;
}
