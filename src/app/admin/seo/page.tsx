import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTrustBar } from "@/components/admin/DataTrustBar";
import {
  SeoKeywordsTab,
  SeoMissing,
  SeoOverviewTab,
  SeoPagesTab,
  SeoPlanTab,
  SeoRoadmapTab,
  SeoSocialTab,
  SeoTasksTab,
} from "@/components/admin/SeoPanels";
import {
  getSeoAi,
  getSeoKeywords,
  getSeoOverview,
  getSeoPages,
  getSeoSocial,
} from "@/lib/services/seo-command-center";
import {
  getContentPlan,
  getRoadmap,
  getSeoTasks,
} from "@/lib/services/seo-plan-data";
import { AiVisibilityPanel } from "@/components/admin/seo/AiVisibilityPanel";
import { getSeoScorecard } from "@/lib/services/seo-scorecard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrustBar } from "@/lib/services/data-trust-bar-data";
import { canEditAdmin, requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "SEO",
  robots: { index: false, follow: false },
};

// Every load reads the tables fresh: tasks change from this page.
export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "pages", label: "Pages" },
  { key: "keywords", label: "Keywords & AEO" },
  { key: "plan", label: "Content Plan" },
  { key: "tasks", label: "Tasks" },
  { key: "social", label: "Social" },
  { key: "roadmap", label: "Roadmap" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminSeoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab: TabKey =
    TABS.find((t) => t.key === one(params.tab))?.key ?? "overview";
  const [{ user, role }, trust] = await Promise.all([
    requireReadAccess(),
    getTrustBar("seo"),
  ]);
  const canEdit = canEditAdmin(role);

  return (
    <AdminShell
      activeSection="seo"
      eyebrow="Reporting"
      title="SEO command center"
      description="Google search, AI Overview citations, the 63-piece content plan, the tasks Kody's triggers open every Monday, and social reach, on one screen."
      userEmail={user.email}
      userRole={role}
    >
      <DataTrustBar model={trust} />
      <nav
        aria-label="SEO sections"
        className="border-ui-line mb-5 flex flex-wrap gap-1 border-b"
      >
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/seo?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${t.key === tab ? "border-ui-accent text-ui-text font-medium" : "text-ui-text-muted hover:text-ui-text border-transparent"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <TabBody tab={tab} params={params} canEdit={canEdit} />
    </AdminShell>
  );
}

async function TabBody({
  tab,
  params,
  canEdit,
}: {
  tab: TabKey;
  params: SearchParams;
  canEdit: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  switch (tab) {
    case "overview": {
      const [data, scorecard] = await Promise.all([
        getSeoOverview(),
        getSeoScorecard(createAdminClient()),
      ]);
      return data.missing ? (
        <SeoMissing />
      ) : (
        <SeoOverviewTab data={data} scorecard={scorecard} />
      );
    }
    case "pages": {
      const data = await getSeoPages();
      return data.missing ? (
        <SeoMissing />
      ) : (
        <SeoPagesTab pages={data.pages} asOf={data.asOf} />
      );
    }
    case "keywords": {
      const [data, ai] = await Promise.all([getSeoKeywords(), getSeoAi()]);
      return data.missing ? (
        <SeoMissing />
      ) : (
        <div className="space-y-5">
          <AiVisibilityPanel data={ai} />
          <SeoKeywordsTab {...data} />
        </div>
      );
    }
    case "plan": {
      const plan = await getContentPlan();
      return plan.missing ? (
        <SeoMissing />
      ) : (
        <SeoPlanTab plan={plan} canEdit={canEdit} />
      );
    }
    case "tasks": {
      const status =
        (["open", "done", "all"] as const).find(
          (s) => s === one(params.status),
        ) ?? "open";
      const data = await getSeoTasks({ status, type: one(params.type) });
      return data.missing ? (
        <SeoMissing />
      ) : (
        <SeoTasksTab
          tasks={data.tasks}
          canEdit={canEdit}
          status={status}
          today={today}
        />
      );
    }
    case "social": {
      // Mike's accounts count toward the brand (Adam, 2026-09-29).
      const allBrands = one(params.brands) !== "vp";
      const data = await getSeoSocial({ allBrands });
      return data.missing ? (
        <SeoMissing />
      ) : (
        <SeoSocialTab data={data} allBrands={allBrands} />
      );
    }
    case "roadmap": {
      const data = await getRoadmap();
      return data.missing ? (
        <SeoMissing />
      ) : (
        <SeoRoadmapTab
          items={data.items}
          reviews={data.reviews}
          canEdit={canEdit}
          month={today.slice(0, 7)}
        />
      );
    }
  }
}
