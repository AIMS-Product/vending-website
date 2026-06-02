import type { Metadata } from "next";
import {
  generateBuilderPageMetadata,
  renderBuilderPage,
} from "@/lib/page-builder/public-page-route";
import type { LeadSearchParams } from "@/lib/lead-attribution";

type Params = { slug: string };

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  return generateBuilderPageMetadata("/solutions", slug);
}

export default async function SolutionsBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<LeadSearchParams>;
}) {
  const { slug } = await params;
  return renderBuilderPage({ routePrefix: "/solutions", slug, searchParams });
}
