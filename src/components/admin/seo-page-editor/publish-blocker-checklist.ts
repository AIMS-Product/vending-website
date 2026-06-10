import type { PageContent } from "@/lib/page-builder/blocks";
import type {
  SeoReadinessFinding,
  SeoReadinessSummary,
} from "@/lib/page-builder/seo-readiness";
import {
  anchorForFinding,
  friendlyFindingLocation,
} from "@/components/admin/seo-page-editor/SeoReadinessHelpers";

// A single canonical publish-blocker item. The chip count, the rendered
// checklist, and the disabled Publish button all derive from one list of these
// so the three surfaces can never disagree about what is blocking publish.
export type PublishBlockerTarget =
  | { kind: "save-first" }
  | { kind: "field"; elementId: string }
  | { kind: "anchor"; anchor: string }
  | { kind: "block-modal"; blockIndex: number };

export type PublishBlockerChecklistItem = {
  code: string;
  // Plain-language action, e.g. "Add a headline to the hero section". Never a
  // schema path, field code, or internal name.
  label: string;
  // The original blocker message (for screen-reader detail / evidence).
  detail: string;
  target: PublishBlockerTarget;
};

// SEO settings fields live in the right sidebar and map to a focusable element.
const SEO_FIELD_IDS: Record<string, string> = {
  title: "page-title-field",
  slug: "page-slug-field",
  seo_title: "seo-title-field",
  target_keyword: "seo-target-keyword-field",
  meta_description: "page-meta-description-field",
  canonical_url: "seo-canonical-url-field",
  noindex: "seo-noindex-field",
  sitemap_enabled: "seo-sitemap-enabled-field",
};

// Human-readable action phrasing per blocker code (I19: clarify the cues).
const ACTION_LABELS: Record<string, string> = {
  invalid_slug: "Add a valid page URL slug",
  missing_title: "Add a page title",
  missing_seo_title: "Add an SEO title",
  missing_meta_description: "Add a meta description",
  sitemap_noindex_conflict:
    "Remove this page from the sitemap or turn off “Hide from search engines”",
  invalid_canonical_url: "Fix the preferred URL so it is a valid link",
  missing_conversion_block:
    "Add a call-to-action, hero button, or lead form so visitors can act",
  missing_image_alt: "Add alt text to the image",
  missing_media_rights: "Add source and rights notes to the image",
  missing_cta_label: "Add button text to the call-to-action",
  missing_cta_href: "Add a destination URL to the call-to-action",
  missing_cta_tracking: "Add a tracking name to the call-to-action",
  missing_hero_heading: "Add a headline to the hero section",
  missing_hero_cta_label: "Add button text to the hero call-to-action",
  missing_hero_cta_href: "Add a destination URL to the hero call-to-action",
  missing_hero_cta_tracking: "Add a tracking name to the hero call-to-action",
  missing_split_hero_media_or_proof:
    "Add an image or proof point to the split hero",
  missing_split_hero_media_alt: "Add alt text to the split hero media",
  missing_video_url: "Add a video URL",
  missing_faq_question: "Add a question to the FAQ",
  missing_faq_answer: "Add an answer to the FAQ",
  empty_card_grid: "Add at least one card to the card grid",
  incomplete_card_title: "Add a title to the card",
  incomplete_card_body: "Add body copy to the card",
};

function blockIndexFromPath(path: string): number | null {
  const match = path.match(/^blocks\.(\d+)\./);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isFinite(index) ? index : null;
}

function labelForBlocker(finding: SeoReadinessFinding): string {
  const base = ACTION_LABELS[finding.code];
  if (base) {
    const blockIndex = blockIndexFromPath(finding.path);
    // Disambiguate when several blocks of the same type exist (e.g. two CTAs).
    if (blockIndex !== null) return `${base} (content ${blockIndex + 1})`;
    return base;
  }
  // Fallback: friendly location + the rule message, never the raw path.
  return `${friendlyFindingLocation(finding)}: ${finding.message}`;
}

function targetForBlocker(
  content: PageContent,
  finding: SeoReadinessFinding,
): PublishBlockerTarget {
  const blockIndex = blockIndexFromPath(finding.path);
  if (blockIndex !== null) {
    // Block-level fields (CTA destination, hero CTA, image alt/rights, FAQ
    // question/answer, card copy) are edited inside the block-settings modal.
    return { kind: "block-modal", blockIndex };
  }

  const fieldId = SEO_FIELD_IDS[finding.path];
  if (fieldId) return { kind: "field", elementId: fieldId };

  const anchor = anchorForFinding(content, finding);
  if (anchor) return { kind: "anchor", anchor };

  // Page-level content blocker with no precise field (e.g. missing conversion
  // block): point at the page content region.
  return { kind: "anchor", anchor: "#builder-block-1" };
}

export function derivePublishBlockerChecklist({
  content,
  summary,
  canPublish,
}: {
  content: PageContent;
  summary: SeoReadinessSummary;
  canPublish: boolean;
}): PublishBlockerChecklistItem[] {
  const items: PublishBlockerChecklistItem[] = summary.blockers.map(
    (blocker) => ({
      code: blocker.code,
      label: labelForBlocker(blocker),
      detail: blocker.message,
      target: targetForBlocker(content, blocker),
    }),
  );

  // The page must be saved before publish is possible. This is an existing
  // publish precondition (publishDisabled already includes !canPublish), not a
  // new readiness rule — it is surfaced here so the checklist explains the full
  // disabled state in one place.
  if (!canPublish) {
    items.push({
      code: "save_draft_first",
      label: "Save this draft to create the page before publishing",
      detail:
        "Saving creates the page record and enables publishing once the checklist is clear.",
      target: { kind: "save-first" },
    });
  }

  return items;
}
