import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { funnelPlanMarkdown, funnelPlanTitle } from "@/lib/content/funnel-plan";
import { renderMarkdown } from "@/lib/markdown";
import { getAuthorizedAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: `Team | ${funnelPlanTitle}`,
  description: "Internal content funnel plan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Internal briefing (Close conversion rates, competitor notes). Same gate as
 * /masterclass-review: the proxy's /admin gate does not cover this path, so
 * the page checks the session itself and sends anyone else to the login.
 */
export default async function FunnelPlanPage() {
  const admin = await getAuthorizedAdmin();
  if (!admin) redirect("/admin/login?next=%2Ffunnel-plan");
  const html = await renderMarkdown(funnelPlanMarkdown, { gfm: true });
  return (
    <main className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight">
        {funnelPlanTitle}
      </h1>
      <div
        className="public-news-prose mt-8 [&_table]:block [&_table]:max-w-full [&_table]:border-collapse [&_table]:overflow-x-auto [&_table]:text-sm [&_td]:border-b [&_td]:border-black/10 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border-b-2 [&_th]:border-black/20 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
