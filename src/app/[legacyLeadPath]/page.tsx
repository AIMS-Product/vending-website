import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { submitApplicationLead } from "@/app/apply/actions";
import { LegacyLeadPageContent } from "@/components/sections/LegacyLeadPageContent";
import {
  getLegacyLeadRoute,
  legacyLeadRoutes,
} from "@/lib/content/legacy-routes";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";

type LegacyLeadPageProps = {
  params: Promise<{ legacyLeadPath: string }>;
  searchParams: Promise<LeadSearchParams>;
};

export function generateStaticParams() {
  return legacyLeadRoutes.map((route) => ({
    legacyLeadPath: route.slug,
  }));
}

export async function generateMetadata({
  params,
}: Pick<LegacyLeadPageProps, "params">): Promise<Metadata> {
  const { legacyLeadPath } = await params;
  const route = getLegacyLeadRoute(legacyLeadPath);

  if (!route) return {};

  return {
    title: route.metadataTitle,
    description:
      "Apply to the Vending Accelerator Program with source attribution preserved for this legacy Vendingpreneurs route.",
    robots: route.indexable ? undefined : { index: false, follow: false },
    alternates: {
      canonical: route.indexable ? route.path : "/contact",
    },
  };
}

export default async function LegacyLeadPage({
  params,
  searchParams,
}: LegacyLeadPageProps) {
  const { legacyLeadPath } = await params;
  const route = getLegacyLeadRoute(legacyLeadPath);

  if (!route) notFound();

  const attribution = buildLeadAttribution(await searchParams, route.path);

  return (
    <LegacyLeadPageContent
      action={submitApplicationLead}
      attribution={attribution}
      idempotencyKey={randomUUID()}
      route={route}
    />
  );
}
