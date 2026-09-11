import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { MarketingLinkBuilder } from "@/components/admin/MarketingLinkBuilder";
import {
  bitlyConnected,
  listMarketingLinks,
} from "@/lib/services/marketing-links";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Links",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLinksPage() {
  const [{ user, role }, links] = await Promise.all([
    requireAdmin(),
    listMarketingLinks(),
  ]);

  return (
    <AdminShell
      activeSection="links"
      eyebrow="Marketing"
      title="Links"
      description="Build every outbound link here. The five UTMs are the attribution, and utm_term says where the link sends people."
      userEmail={user.email}
      userRole={role}
    >
      <MarketingLinkBuilder links={links} bitlyConnected={bitlyConnected()} />
    </AdminShell>
  );
}
