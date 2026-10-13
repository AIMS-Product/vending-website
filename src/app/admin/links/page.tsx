import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminLinkClass } from "@/components/admin/AdminUi";
import { MarketingLinkBuilder } from "@/components/admin/MarketingLinkBuilder";
import {
  bitlyConnected,
  getLinkRegistry,
} from "@/lib/services/marketing-links";
import { requireReadAccess } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Links",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLinksPage() {
  const [{ user, role }, registry] = await Promise.all([
    requireReadAccess(),
    getLinkRegistry(),
  ]);

  return (
    <AdminShell
      activeSection="links"
      eyebrow="Marketing"
      title="Links"
      description="Make every outbound link here, then see what each one brought in. One link per post, show or send."
      userEmail={user.email}
      userRole={role}
    >
      <div className="space-y-5">
        <p className="text-ui-text-subtle text-xs">
          <Link href="/admin/links/coverage" className={adminLinkClass}>
            Link coverage
          </Link>{" "}
          shows how many leads arrived on a link that is in this registry, and
          lists the ones that are missing from it.
        </p>
        <MarketingLinkBuilder
          links={registry.links}
          statsFailed={registry.statsFailed}
          bitlyConnected={bitlyConnected()}
        />
      </div>
    </AdminShell>
  );
}
