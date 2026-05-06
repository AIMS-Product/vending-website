import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourcePageRenderer } from "@/components/sections/ResourcePageRenderer";
import { getSeoPagePreviewByToken } from "@/lib/services/seo-pages";

type Params = { token: string };

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Resource preview",
  robots: { index: false, follow: false },
};

export default async function ResourcePreviewPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const page = await getSeoPagePreviewByToken(token);
  if (!page) notFound();

  return (
    <ResourcePageRenderer page={page} idempotencyKeyPrefix={randomUUID()} />
  );
}
