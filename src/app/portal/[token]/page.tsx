import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalPage } from "@/components/portal/PortalPage";
import { getPortalData } from "@/lib/portal/get-portal-data";
import { winTypesFor } from "@/lib/portal/personalize";
import { loadWins } from "@/lib/portal/wins";

type Params = { token: string };

// Per-prospect, tokenized, never indexed, never cached across prospects.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Vendingpreneurs plan",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();
  const wins = await loadWins(winTypesFor(data.stage));
  return <PortalPage data={data} wins={wins} />;
}
