import { pageContentSchema, type PageContent } from "@/lib/page-builder/blocks";
import {
  createEditablePageContent,
  createPageBlock,
} from "@/lib/page-builder/content-ops";

export type PageTypeId = "resource" | "blog" | "landing" | "video";
export type PageTemplateKey =
  | "blank"
  | "resource-standard"
  | "blog-standard"
  | "landing-standard"
  | "video-standard";

export type PageTypeOption = {
  id: PageTypeId;
  label: string;
  description: string;
  defaultTemplateKey: PageTemplateKey;
};

export type PageTemplateOption = {
  id: PageTemplateKey;
  pageType: PageTypeId;
  label: string;
  description: string;
  content: PageContent;
};

/** Editor-saved page templates surfaced in the new-page creation flow. */
export type SavedPageTemplateOption = {
  id: string;
  label: string;
  description: string;
  pageType: PageTypeId;
  templateKey: PageTemplateKey;
};

export type ResolvedPageTemplate = {
  pageType: PageTypeId;
  templateKey: PageTemplateKey;
  content: PageContent;
};

export const pageTypeOptions = [
  {
    id: "resource",
    label: "SEO / Resource page",
    description: "Long-form search page for resources, guides, and services.",
    defaultTemplateKey: "resource-standard",
  },
  {
    id: "blog",
    label: "Blog page",
    description: "Article-style page with a strong introduction and CTA.",
    defaultTemplateKey: "blog-standard",
  },
  {
    id: "landing",
    label: "Landing page",
    description: "Campaign page for a focused offer or conversion path.",
    defaultTemplateKey: "landing-standard",
  },
  {
    id: "video",
    label: "Video page",
    description: "Video-led page with supporting copy and conversion blocks.",
    defaultTemplateKey: "video-standard",
  },
] as const satisfies readonly PageTypeOption[];

const blankTemplates = pageTypeOptions.map((pageType) => ({
  id: "blank",
  pageType: pageType.id,
  label: "Blank page",
  description: "Start with an empty editable canvas.",
  content: createEditablePageContent(`${pageType.id}_section_1`),
})) satisfies PageTemplateOption[];

const standardTemplates = [
  {
    id: "resource-standard",
    pageType: "resource",
    label: "Resource default",
    description: "Hero, supporting copy, proof, FAQ, and CTA.",
    content: templateContent("resource", [
      "hero",
      "rich_text",
      "proof",
      "faq",
      "cta",
    ]),
  },
  {
    id: "blog-standard",
    pageType: "blog",
    label: "Blog default",
    description: "Hero, article body, supporting section, FAQ, and CTA.",
    content: templateContent("blog", [
      "hero",
      "rich_text",
      "rich_text",
      "faq",
      "cta",
    ]),
  },
  {
    id: "landing-standard",
    pageType: "landing",
    label: "Landing default",
    description: "Hero, proof, offer details, and CTA.",
    content: templateContent("landing", ["hero", "proof", "rich_text", "cta"]),
  },
  {
    id: "video-standard",
    pageType: "video",
    label: "Video default",
    description: "Hero, video, supporting copy, and CTA.",
    content: templateContent("video", ["hero", "video", "rich_text", "cta"]),
  },
] satisfies PageTemplateOption[];

const pageTemplateOptions = [
  ...blankTemplates,
  ...standardTemplates,
] as const satisfies readonly PageTemplateOption[];

export function templateOptionsForPageType(
  pageType: string,
): PageTemplateOption[] {
  const validPageType = parsePageType(pageType);
  return pageTemplateOptions
    .filter((template) => template.pageType === validPageType)
    .map(cloneTemplateOption);
}

export function getPageTemplate(
  pageType: string,
  templateKey: string,
): ResolvedPageTemplate {
  const validPageType = parsePageType(pageType);
  const template = pageTemplateOptions.find(
    (option) => option.pageType === validPageType && option.id === templateKey,
  );

  if (!template) {
    throw new Error("Unknown page template.");
  }

  return {
    pageType: validPageType,
    templateKey: template.id,
    content: cloneContent(template.content),
  };
}

export function normalizePageTemplateSelection(input: {
  pageType?: string;
  templateKey?: string;
}): ResolvedPageTemplate {
  const pageType = parsePageType(input.pageType ?? "resource");
  return getPageTemplate(pageType, input.templateKey ?? "blank");
}

function parsePageType(pageType: string): PageTypeId {
  if (pageTypeOptions.some((option) => option.id === pageType)) {
    return pageType as PageTypeId;
  }
  throw new Error("Unknown page type.");
}

function cloneTemplateOption(template: PageTemplateOption): PageTemplateOption {
  return { ...template, content: cloneContent(template.content) };
}

function cloneContent(content: PageContent): PageContent {
  return pageContentSchema.parse(JSON.parse(JSON.stringify(content)));
}

function templateContent(
  seed: PageTypeId,
  blockTypes: Parameters<typeof createPageBlock>[0][],
): PageContent {
  const section = createEditablePageContent(`${seed}_section_1`);
  const firstColumn = section.sections[0]?.columns[0];
  if (!firstColumn) return section;

  firstColumn.blocks = blockTypes.map((type, index) =>
    createPageBlock(type, `${seed}_block_${index + 1}`),
  );
  return pageContentSchema.parse(section);
}
