import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { funnelPlanMarkdown, funnelPlanTitle } from "@/lib/content/funnel-plan";
import { labelTableCells } from "@/lib/html-table-labels";
import { renderMarkdown } from "@/lib/markdown";
import { getAuthorizedAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: `Team | ${funnelPlanTitle}`,
  description: "Internal content funnel plan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FunnelPlanPage() {
  const admin = await getAuthorizedAdmin();
  if (!admin) redirect("/admin/login?next=%2Ffunnel-plan");
  const html = labelTableCells(
    await renderMarkdown(funnelPlanMarkdown, { gfm: true }),
  );
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {funnelPlanTitle}
      </h1>
      <div
        className="public-news-prose funnel-plan-prose mt-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
