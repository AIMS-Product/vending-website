import "server-only";

import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { ApplyLandingPage } from "./ApplyLandingPage";
import { applyMeta } from "@/lib/content/apply-page";
import {
  contactClonePath,
  type ContactCloneSlug,
} from "@/lib/content/contact-clone-pages";
import {
  buildLeadAttribution,
  type LeadSearchParams,
} from "@/lib/lead-attribution";

// Shared wiring for the /contact clones so each page.tsx stays a thin
// two-liner. Same page and same lead/qualification flow as /contact; only the
// attribution source_path differs, so leads are tagged to the channel that
// sent them. Canonical + noindex point at /contact so the duplicates are not
// indexed against it.
export function contactCloneMetadata(): Metadata {
  return {
    title: applyMeta.title,
    description: applyMeta.description,
    robots: { index: false, follow: false },
    alternates: { canonical: "/contact" },
  };
}

export async function renderContactClonePage(
  slug: ContactCloneSlug,
  searchParams: Promise<LeadSearchParams>,
) {
  const attribution = buildLeadAttribution(
    await searchParams,
    contactClonePath(slug),
  );

  return (
    <ApplyLandingPage attribution={attribution} idempotencyKey={randomUUID()} />
  );
}
