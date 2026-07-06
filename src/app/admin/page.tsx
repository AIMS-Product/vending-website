import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  adminCardClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { getAdminOverview } from "@/lib/services/admin-overview";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Admin overview",
  robots: { index: false, follow: false },
};

export default async function AdminOverviewPage() {
  const [{ user, role }, overview] = await Promise.all([
    requireAdmin(),
    getAdminOverview(),
  ]);

  const needsAttentionItems = buildNeedsAttentionItems(overview);

  return (
    <AdminShell
      // N5 will add a dedicated "overview" AdminSection value to AdminShell;
      // until then this reuses "pages" so the sidebar still highlights the
      // closest active section without editing AdminShell in this change.
      activeSection="pages"
      eyebrow="Studio overview"
      title="Overview"
      description="A plain-English snapshot of what's live, what's in progress, and what needs your attention."
      userEmail={user.email}
      userRole={role}
    >
      <section aria-label="Content live" className="mb-7">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          Content live
        </h2>
        <AdminMetricStrip>
          <AdminMetricPanel
            icon="file"
            tone="green"
            label="Published pages"
            value={overview.pagesPublished}
            caption="live on the site"
          />
          <AdminMetricPanel
            icon="newspaper"
            tone="green"
            label="Published posts"
            value={overview.postsPublished}
            caption="live on the site"
          />
          <AdminMetricPanel
            icon="pencil"
            tone="amber"
            label="Drafts in progress"
            value={overview.pagesDraft + overview.postsDraft}
            caption="pages and posts"
          />
        </AdminMetricStrip>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href="/admin/pages"
            className="font-semibold text-[#0b63f6] hover:underline"
          >
            View pages
          </Link>
          <Link
            href="/admin/news"
            className="font-semibold text-[#0b63f6] hover:underline"
          >
            View posts
          </Link>
        </div>
      </section>

      <section aria-label="Leads this week" className="mb-7">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          Leads this week
        </h2>
        <div className={adminCardClass}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold tracking-normal text-slate-950">
                {overview.leadsThisWeek}
              </p>
              <p className="text-sm text-slate-600">
                new leads in the last 7 days ({overview.leadsTotal} total)
              </p>
            </div>
            <Link href="/admin/leads" className={adminSecondaryButtonClass}>
              <span aria-hidden="true">
                <AdminIcon icon="mail" />
              </span>
              View leads
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Needs attention" className="mb-7">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          Needs attention
        </h2>
        {needsAttentionItems.length === 0 ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            All clear — nothing needs attention right now.
          </p>
        ) : (
          <ul className="grid gap-3">
            {needsAttentionItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm shadow-sm transition hover:bg-white/60 ${
                    item.tone === "red"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="font-semibold">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Quick actions">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/pages/new" className={adminPrimaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="plus" />
            </span>
            New page
          </Link>
          <Link href="/admin/news/new" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="plus" />
            </span>
            New post
          </Link>
          <Link href="/admin/media" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="image" />
            </span>
            Media
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}

type NeedsAttentionItem = {
  key: string;
  label: string;
  count: number;
  href: string;
  tone: "red" | "neutral";
};

function buildNeedsAttentionItems(overview: {
  failedSyncs: number;
  scheduledPublishFailed: number;
  scheduledPublishPending: number;
}): NeedsAttentionItem[] {
  const items: NeedsAttentionItem[] = [];

  if (overview.failedSyncs > 0) {
    items.push({
      key: "failed-syncs",
      label: "Leads stuck on a failed Close sync",
      count: overview.failedSyncs,
      href: "/admin/leads",
      tone: "red",
    });
  }

  if (overview.scheduledPublishFailed > 0) {
    items.push({
      key: "scheduled-publish-failed",
      label: "Scheduled publishes that failed",
      count: overview.scheduledPublishFailed,
      href: "/admin/pages",
      tone: "red",
    });
  }

  if (overview.scheduledPublishPending > 0) {
    items.push({
      key: "scheduled-publish-pending",
      label: "Pages waiting on a scheduled publish",
      count: overview.scheduledPublishPending,
      href: "/admin/pages",
      tone: "neutral",
    });
  }

  return items;
}
