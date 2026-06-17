import type { LeadAttribution } from "@/lib/lead-attribution";
import {
  qualificationAttachmentSettings,
  type QualificationAttachmentSettings,
} from "@/lib/page-builder/blocks";

type ResourceLeadPage = {
  id: string;
  slug: string;
  target_keyword: string | null;
};

type ResourceLeadBlock = {
  id: string;
  props: {
    trackingName: string;
  };
};

type ResourceQualificationPage = {
  qualification?: Partial<QualificationAttachmentSettings> | null;
};

type ResourceQualificationBlock = {
  id: string;
  props: {
    qualification?: Partial<QualificationAttachmentSettings> | null;
  };
};

export type ResolvedResourceQualificationAttachment = {
  source: "block" | "page" | "global" | "none";
  formId: string | null;
  completionRedirectPath: string | null;
  experimentKey: string | null;
  variantKey: string | null;
};

export function buildResourceLeadFormAttribution({
  baseAttribution,
  page,
  block,
}: {
  baseAttribution?: LeadAttribution;
  page: ResourceLeadPage;
  block: ResourceLeadBlock;
}): LeadAttribution {
  const landingPath = `/resources/${page.slug}`;

  return {
    ...(baseAttribution ?? emptyResourceLeadAttribution(landingPath)),
    source_page_id: page.id,
    source_page_slug: page.slug,
    target_keyword: page.target_keyword ?? "",
    source_block_id: block.id,
    source_cta_tracking_name: block.props.trackingName,
  };
}

export function resolveResourceQualificationAttachment({
  page,
  block,
  globalDefaultFormId,
}: {
  page: ResourceQualificationPage;
  block: ResourceQualificationBlock;
  globalDefaultFormId?: string | null;
}): ResolvedResourceQualificationAttachment {
  const pageSettings = normalizedQualificationSettings(page.qualification);
  const blockSettings = normalizedQualificationSettings(
    block.props.qualification,
  );
  const globalFormId = normalizeOptional(globalDefaultFormId);
  const formId = blockSettings.formId ?? pageSettings.formId ?? globalFormId;

  return {
    source: blockSettings.formId
      ? "block"
      : pageSettings.formId
        ? "page"
        : globalFormId
          ? "global"
          : "none",
    formId,
    completionRedirectPath:
      blockSettings.completionRedirectPath ??
      pageSettings.completionRedirectPath ??
      null,
    experimentKey:
      blockSettings.experimentKey ?? pageSettings.experimentKey ?? null,
    variantKey: blockSettings.variantKey ?? pageSettings.variantKey ?? null,
  };
}

function emptyResourceLeadAttribution(landingPath: string): LeadAttribution {
  return {
    source_path: landingPath,
    landing_path: landingPath,
    referrer: "",
    source_page_id: "",
    source_page_slug: "",
    target_keyword: "",
    source_block_id: "",
    source_cta_tracking_name: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
  };
}

function normalizedQualificationSettings(
  settings?: Partial<QualificationAttachmentSettings> | null,
) {
  const normalized = qualificationAttachmentSettings(settings);
  return {
    formId: normalizeOptional(normalized.formId),
    completionRedirectPath: normalizeOptional(
      normalized.completionRedirectPath,
    ),
    experimentKey: normalizeOptional(normalized.experimentKey),
    variantKey: normalizeOptional(normalized.variantKey),
  };
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
