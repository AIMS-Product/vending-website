import type { Metadata } from "next";
import { NewsletterPage } from "@/components/sections/NewsletterPage";
import {
  NEWSLETTER_META_DESCRIPTION,
  NEWSLETTER_PAGE_TITLE,
} from "@/lib/content/newsletter";
import type { LeadSearchParams } from "@/lib/lead-attribution";

export const metadata: Metadata = {
  title: { absolute: NEWSLETTER_PAGE_TITLE },
  description: NEWSLETTER_META_DESCRIPTION,
  alternates: { canonical: "/newsletter" },
};

export default function NewsletterRoute({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  return <NewsletterPage searchParams={searchParams} />;
}
