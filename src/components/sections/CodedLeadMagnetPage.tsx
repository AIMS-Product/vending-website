import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { ResourcePageRenderer } from "@/components/sections/ResourcePageRenderer";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";
import { resolvePhoneRequiredByFormId } from "@/lib/page-builder/resource-qualification-policy";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";

/**
 * Renders a code-held lead-magnet page through the same renderer as the
 * page-builder routes, so attribution, the qualification form and the phone
 * policy all behave identically to a published builder page.
 */
export async function CodedLeadMagnetPage({
  page,
  searchParams,
}: {
  page: PublishedSeoPage;
  searchParams: Promise<LeadSearchParams>;
}) {
  const query = await searchParams;
  const phoneRequiredByFormId = await resolvePhoneRequiredByFormId(
    page.published_content,
  );

  return (
    <ResourcePageRenderer
      page={page}
      phoneRequiredByFormId={phoneRequiredByFormId}
      leadAttribution={buildLeadAttribution(query, page.route_path)}
      idempotencyKeyPrefix={randomUUID()}
    />
  );
}

export function leadMagnetMetadata(page: PublishedSeoPage): Metadata {
  return {
    title: page.seo_title ?? page.title,
    description: page.meta_description ?? undefined,
    alternates: { canonical: page.route_path },
    robots: page.noindex ? { index: false, follow: false } : undefined,
  };
}
