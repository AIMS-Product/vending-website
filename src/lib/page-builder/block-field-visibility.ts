import type { PageBlock } from "@/lib/page-builder/blocks";

export type OptionalBlockFieldKey =
  | "eyebrow"
  | "heading"
  | "body"
  | "cta"
  | "mediaCaption"
  | "caption"
  | "title"
  | "name"
  | "context";

type FieldVisibilityProps = {
  fieldVisibility?: Partial<Record<OptionalBlockFieldKey, boolean>>;
};

export const optionalBlockFields: Record<
  PageBlock["type"],
  readonly OptionalBlockFieldKey[]
> = {
  hero: ["eyebrow", "body", "cta", "mediaCaption"],
  rich_text: ["eyebrow", "heading"],
  image: ["caption"],
  video: ["title", "caption"],
  cta: [],
  faq: ["heading"],
  card_grid: ["heading"],
  proof: ["eyebrow", "name", "context"],
  lead_form: ["heading", "body"],
};

export const optionalBlockFieldLabels: Record<OptionalBlockFieldKey, string> = {
  eyebrow: "Eyebrow",
  heading: "Heading",
  body: "Body",
  cta: "CTA",
  mediaCaption: "Media caption",
  caption: "Caption",
  title: "Title",
  name: "Name",
  context: "Context",
};

export function optionalFieldsForBlock(
  block: PageBlock,
): readonly OptionalBlockFieldKey[] {
  return optionalBlockFields[block.type];
}

export function defaultFieldVisibility(
  block: Pick<PageBlock, "type" | "variant">,
): Partial<Record<OptionalBlockFieldKey, boolean>> {
  if (block.type === "hero") {
    return {
      eyebrow: false,
      body: block.variant !== "compact",
      cta: block.variant !== "editorial",
      mediaCaption: false,
    };
  }

  if (block.type === "rich_text") {
    return {
      eyebrow: false,
      heading: block.variant !== "compact",
    };
  }

  if (block.type === "image") {
    return { caption: false };
  }

  if (block.type === "video") {
    return { title: true, caption: false };
  }

  if (block.type === "faq" || block.type === "card_grid") {
    return { heading: true };
  }

  if (block.type === "proof") {
    return {
      eyebrow: false,
      name: block.variant !== "logo",
      context: block.variant !== "logo",
    };
  }

  if (block.type === "lead_form") {
    return { heading: true, body: true };
  }

  return {};
}

export function isBlockFieldVisible(
  block: PageBlock,
  field: OptionalBlockFieldKey,
): boolean {
  const allowed = optionalFieldsForBlock(block);
  if (!allowed.includes(field)) return true;

  const stored = (block.props as FieldVisibilityProps).fieldVisibility?.[field];
  if (stored !== undefined) return stored;

  return inferFieldVisibilityFromContent(block, field);
}

export function setBlockFieldVisibility(
  block: PageBlock,
  field: OptionalBlockFieldKey,
  visible: boolean,
): PageBlock {
  const current = {
    ...defaultFieldVisibility(block),
    ...((block.props as FieldVisibilityProps).fieldVisibility ?? {}),
  };

  return {
    ...block,
    props: {
      ...block.props,
      fieldVisibility: {
        ...current,
        [field]: visible,
      },
    },
  } as PageBlock;
}

function inferFieldVisibilityFromContent(
  block: PageBlock,
  field: OptionalBlockFieldKey,
): boolean {
  if (block.type === "hero") {
    if (field === "eyebrow") return hasText(block.props.eyebrow);
    if (field === "body") return hasText(block.props.body);
    if (field === "cta") {
      return (
        hasText(block.props.ctaLabel) ||
        hasText(block.props.ctaHref) ||
        block.variant !== "editorial"
      );
    }
    if (field === "mediaCaption") return hasText(block.props.mediaCaption);
  }

  if (block.type === "rich_text") {
    if (field === "eyebrow") return hasText(block.props.eyebrow);
    if (field === "heading") return hasText(block.props.heading);
  }

  if (block.type === "image" && field === "caption") {
    return hasText(block.props.caption);
  }

  if (block.type === "video") {
    if (field === "title") return hasText(block.props.title);
    if (field === "caption") return hasText(block.props.caption);
  }

  if (block.type === "faq" && field === "heading") {
    return hasText(block.props.heading);
  }

  if (block.type === "card_grid" && field === "heading") {
    return hasText(block.props.heading);
  }

  if (block.type === "proof") {
    if (field === "eyebrow") return hasText(block.props.eyebrow);
    if (field === "name") return hasText(block.props.name);
    if (field === "context") return hasText(block.props.context);
  }

  if (block.type === "lead_form") {
    if (field === "heading") return hasText(block.props.heading);
    if (field === "body") return hasText(block.props.body);
  }

  return defaultFieldVisibility(block)[field] ?? false;
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function withDefaultFieldVisibility(block: PageBlock): PageBlock {
  const fields = optionalFieldsForBlock(block);
  if (fields.length === 0) return block;

  const stored = (block.props as FieldVisibilityProps).fieldVisibility;
  if (stored && fields.every((field) => stored[field] !== undefined)) {
    return block;
  }

  return {
    ...block,
    props: {
      ...block.props,
      fieldVisibility: {
        ...defaultFieldVisibility(block),
        ...stored,
      },
    },
  } as PageBlock;
}
