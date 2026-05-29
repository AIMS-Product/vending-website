import type { PageBlock, PageContent } from "@/lib/page-builder/blocks";
import type {
  SeoReadinessFinding,
  SeoReadinessSummary,
} from "@/lib/page-builder/seo-readiness";

export type NextPublishStep = {
  title: string;
  detail: string;
  tone: "blocked" | "work" | "ready";
};

export function scrollToBuilderBlockId(blockId: string) {
  window.setTimeout(() => {
    document
      .querySelector<HTMLElement>(`[data-builder-block-id="${blockId}"]`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
  }, 0);
}

export function suggestedBlockForFinding(
  finding: SeoReadinessFinding,
): { type: PageBlock["type"]; label: string } | null {
  if (
    finding.code === "missing_relevant_image" ||
    finding.code === "empty_image_source" ||
    finding.code === "empty_image_alt_text"
  ) {
    return { type: "image", label: "Add image" };
  }
  if (
    finding.code === "missing_faq_opportunity" ||
    finding.code === "empty_faq_block"
  ) {
    return { type: "faq", label: "Add FAQ section" };
  }
  if (
    finding.code === "missing_conversion_block" ||
    finding.code === "empty_cta_label" ||
    finding.code === "empty_cta_link"
  ) {
    return { type: "cta", label: "Add CTA" };
  }
  if (
    finding.code === "missing_supporting_subsections" ||
    finding.code === "content_depth_light"
  ) {
    return { type: "rich_text", label: "Add text section" };
  }
  return null;
}

export function anchorForFinding(
  content: PageContent,
  finding: SeoReadinessFinding,
) {
  if (finding.path === "title") return "#page-title-field";
  if (finding.path === "meta_description")
    return "#page-meta-description-field";
  if (finding.path.startsWith("blocks.")) {
    const [, blockIndex] = finding.path.split(".");
    const blockNumber = Number(blockIndex) + 1;
    if (Number.isFinite(blockNumber)) {
      return `#builder-block-${blockNumber}`;
    }
  }
  const globalBlockIndex = globalBlockIndexFromNestedPath(
    content,
    finding.path,
  );
  if (globalBlockIndex !== null) {
    return `#builder-block-${globalBlockIndex + 1}`;
  }
  return null;
}

export function requiresSeoSettings(finding: SeoReadinessFinding) {
  return [
    "seo_title",
    "target_keyword",
    "canonical_url",
    "slug",
    "noindex",
    "sitemap_enabled",
  ].some(
    (path) => finding.path === path || finding.path.startsWith(`${path}.`),
  );
}

export function friendlyFindingLocation(finding: SeoReadinessFinding) {
  if (finding.path === "slug") return "URL slug";
  if (finding.path === "title") return "Page title";
  if (finding.path === "seo_title") return "SEO title";
  if (finding.path === "target_keyword") return "Target keyword";
  if (finding.path === "meta_description") return "Meta description";
  if (finding.path === "sections") return "Page content";
  if (finding.path.startsWith("blocks.")) {
    const [, blockIndex, , propName, childIndex, childField] =
      finding.path.split(".");
    const blockNumber = Number(blockIndex) + 1;
    const readableProp = friendlyFieldName(childField ?? propName);
    if (childIndex !== undefined && childField) {
      const itemNumber = readableChildItemNumber(childIndex);
      if (itemNumber === null) {
        return `Content ${blockNumber} · ${friendlyFieldName(
          propName,
        )} ${readableProp}`;
      }
      return `Content ${blockNumber} · ${friendlyFieldName(propName)} ${
        itemNumber
      } ${readableProp}`;
    }
    return `Content ${blockNumber} · ${readableProp}`;
  }
  const nestedBlockLocation = friendlyNestedBlockLocation(finding.path);
  if (nestedBlockLocation) return nestedBlockLocation;
  return friendlyFieldName(finding.path);
}

function nestedBlockLocationFromPath(path: string) {
  const match = path.match(/^sections\.(\d+)\.columns\.(\d+)\.blocks\.(\d+)\./);
  if (!match) return null;
  const [, sectionValue, columnValue, blockValue] = match;
  const sectionIndex = Number(sectionValue);
  const columnIndex = Number(columnValue);
  const blockIndex = Number(blockValue);
  if (
    !Number.isFinite(sectionIndex) ||
    !Number.isFinite(columnIndex) ||
    !Number.isFinite(blockIndex)
  ) {
    return null;
  }
  return { sectionIndex, columnIndex, blockIndex };
}

function globalBlockIndexFromNestedPath(content: PageContent, path: string) {
  const target = nestedBlockLocationFromPath(path);
  if (!target) return null;

  let globalIndex = 0;
  for (const [sectionIndex, section] of content.sections.entries()) {
    for (const [columnIndex, column] of section.columns.entries()) {
      if (
        sectionIndex === target.sectionIndex &&
        columnIndex === target.columnIndex
      ) {
        return target.blockIndex < column.blocks.length
          ? globalIndex + target.blockIndex
          : null;
      }
      globalIndex += column.blocks.length;
    }
  }

  return null;
}

function friendlyNestedBlockLocation(path: string) {
  const match = path.match(
    /^sections\.\d+\.columns\.\d+\.blocks\.(\d+)\.props\.([^.]+)(?:\.(\d+)\.([^.]+))?/,
  );
  if (!match) return null;
  const [, blockIndex, propName, childIndex, childField] = match;
  const blockNumber = Number(blockIndex) + 1;
  const readableProp = friendlyFieldName(childField ?? propName);
  if (childIndex !== undefined && childField) {
    const itemNumber = readableChildItemNumber(childIndex);
    if (itemNumber === null) {
      return `Content ${blockNumber} · ${friendlyFieldName(
        propName,
      )} ${readableProp}`;
    }
    return `Content ${blockNumber} · ${friendlyFieldName(propName)} ${
      itemNumber
    } ${readableProp}`;
  }
  return `Content ${blockNumber} · ${readableProp}`;
}

function readableChildItemNumber(childIndex: string) {
  const itemIndex = Number(childIndex);
  return Number.isFinite(itemIndex) ? itemIndex + 1 : null;
}

export function friendlyReadinessCategoryLabel(
  category: SeoReadinessSummary["categories"][number]["category"],
) {
  if (category === "serp") return "Search result";
  if (category === "schema") return "FAQ help";
  return {
    indexing: "Search visibility",
    content: "Page content",
    links: "Internal links",
    media: "Images",
    conversion: "Enquiries",
    trust: "Trust proof",
  }[category];
}

export function nextRequiredPublishStep({
  canPublish,
  hasUnpublishedDraftChanges,
  isPublishedPage,
  summary,
}: {
  canPublish: boolean;
  hasUnpublishedDraftChanges: boolean;
  isPublishedPage: boolean;
  summary: SeoReadinessSummary;
}): NextPublishStep {
  const blocker = summary.blockers[0];
  if (blocker) {
    return {
      title: `Fix ${friendlyActionLocation(blocker)}`,
      detail: blocker.message,
      tone: "blocked",
    };
  }

  if (!canPublish) {
    return {
      title: "Save this draft",
      detail:
        "Saving creates the page record, unlocks the SEO agent, and enables publishing after the checklist is clear.",
      tone: "work",
    };
  }

  const warning = summary.warnings[0];
  if (warning) {
    return {
      title: `Improve ${friendlyActionLocation(warning)}`,
      detail: warning.message,
      tone: "work",
    };
  }

  if (isPublishedPage) {
    return {
      title: hasUnpublishedDraftChanges
        ? "Ready to publish changes"
        : "Published page is live",
      detail: hasUnpublishedDraftChanges
        ? "The live page is unchanged. Publish changes when this draft should replace the current public version."
        : "Save draft changes to keep editing without replacing the live page, then publish when the changes are ready.",
      tone: "ready",
    };
  }

  return {
    title: "Ready to publish",
    detail:
      "No hard blockers remain. Review the public preview, then publish when the page is ready.",
    tone: "ready",
  };
}

function friendlyActionLocation(finding: SeoReadinessFinding) {
  const location = friendlyFindingLocation(finding);
  if (/^[A-Z]{2,}\b/.test(location)) return location;
  return `${location.charAt(0).toLowerCase()}${location.slice(1)}`;
}

export function friendlyEvidenceText(finding: SeoReadinessFinding) {
  if (!finding.evidence) return null;
  if (finding.evidence.startsWith("Field: ")) {
    return `Field: ${friendlyFindingLocation(finding)}`;
  }
  return finding.evidence;
}

function friendlyFieldName(value: string | undefined) {
  if (!value) return "Field";
  if (value === "ctaHref" || value === "href") {
    return "Destination URL";
  }
  if (value === "trackingName" || value === "ctaTrackingName") {
    return "Internal CTA label";
  }
  if (value === "canonical_url" || value === "canonicalUrl") {
    return "Preferred URL";
  }
  if (value === "src") return "Image";
  if (value === "altText") return "Alt text";
  if (value === "sourceRightsNotes") return "Rights notes";
  if (value === "assetId") return "Media asset";
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function findingSeverityLabel(
  severity: SeoReadinessFinding["severity"],
) {
  if (severity === "blocker") return "Must fix";
  if (severity === "warning") return "Should fix";
  return "Opportunity";
}
