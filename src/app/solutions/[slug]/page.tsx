import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SolutionPage } from "@/components/sections/SolutionPage";
import { getSolution, listSolutionSlugs } from "@/lib/content/solutions";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return listSolutionSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  const title = solution.metaTitle ?? solution.title;
  const description = solution.metaDescription ?? solution.intro;

  return {
    title,
    description,
    alternates: { canonical: `/solutions/${solution.slug}` },
    openGraph: {
      title,
      description,
      url: `/solutions/${solution.slug}`,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  return <SolutionPage solution={solution} />;
}
