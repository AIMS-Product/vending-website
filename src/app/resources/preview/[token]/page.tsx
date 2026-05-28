import { randomUUID } from "node:crypto";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourcePageRenderer } from "@/components/sections/ResourcePageRenderer";
import { getSeoPagePreviewByToken } from "@/lib/services/seo-pages";

type Params = { token: string };

export const revalidate = 0;

const getPreviewPage = cache((token: string) =>
  getSeoPagePreviewByToken(token),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { token } = await params;
  const page = await getPreviewPage(token);
  if (!page) notFound();

  return {
    title: "Resource preview",
    robots: { index: false, follow: false },
  };
}

export default async function ResourcePreviewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const page = await getPreviewPage(token);
  if (!page) notFound();

  return (
    <ResourcePageRenderer
      page={page}
      idempotencyKeyPrefix={randomUUID()}
      showPreviewEmptyState
    />
  );
}
