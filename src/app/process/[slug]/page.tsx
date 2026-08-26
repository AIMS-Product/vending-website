import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/sections/ContentPage";
import {
  getProcessStep,
  listProcessSlugs,
  processNeighbours,
} from "@/lib/content/process";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return listProcessSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const step = getProcessStep(slug);
  if (!step) notFound();

  const title = step.metaTitle ?? step.title;
  const description = step.metaDescription ?? step.intro;

  return {
    title,
    description,
    alternates: { canonical: `/process/${step.slug}` },
    openGraph: {
      title,
      description,
      url: `/process/${step.slug}`,
      type: "article",
    },
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const step = getProcessStep(slug);
  if (!step) notFound();

  // Prev/next lead the related cards and are derived from the step order, so
  // the sequence can't drift; the step's own cards follow.
  const page = {
    ...step,
    related: [...processNeighbours(slug), ...step.related],
  };

  return <ContentPage page={page} />;
}
