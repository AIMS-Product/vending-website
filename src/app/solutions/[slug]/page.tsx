import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/sections/ContentPage";
import { getSolution, listSolutionSlugs } from "@/lib/content/solutions";
import { breadcrumbStructuredData } from "@/lib/site-structured-data";

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
    // `follow` stays on: a held-back page should still pass link equity and
    // let a crawler reach what it points at.
    ...(solution.noindex ? { robots: { index: false, follow: true } } : {}),
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

  const breadcrumbs = breadcrumbStructuredData([
    { name: "Solutions", path: "/solutions" },
    { name: solution.title, path: `/solutions/${solution.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised server-side from our own static config, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <ContentPage page={solution} />
    </>
  );
}
