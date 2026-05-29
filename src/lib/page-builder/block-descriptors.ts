import type { PageBlock } from "@/lib/page-builder/blocks";
import type { OptionalBlockFieldKey } from "@/lib/page-builder/block-field-visibility";

type BlockFor<TType extends PageBlock["type"]> = Extract<
  PageBlock,
  { type: TType }
>;

type BlockVariantOption<TType extends PageBlock["type"]> = {
  id: BlockFor<TType>["variant"];
  label: string;
  description: string;
};

type BlockParityMarkerAdders = {
  addText: (label: string, value: string | undefined) => void;
  addImgAlt: (label: string, value: string | undefined) => void;
};

export type PageBlockDescriptor<TType extends PageBlock["type"]> = {
  type: TType;
  label: string;
  description: string;
  variants: readonly BlockVariantOption<TType>[];
  defaultVariant: BlockFor<TType>["variant"];
  defaultProps: BlockFor<TType>["props"];
  optionalFields: readonly OptionalBlockFieldKey[];
  defaultFieldVisibility: Partial<Record<OptionalBlockFieldKey, boolean>>;
  editor: {
    canvasPlaceholders: Record<string, string>;
    publicRenderer: string;
  };
  createBlock: (id: string) => BlockFor<TType>;
  createPreviewBlock: (
    id: string,
    variant: BlockFor<TType>["variant"],
  ) => BlockFor<TType>;
  addParityMarkers: (
    block: BlockFor<TType>,
    adders: BlockParityMarkerAdders,
  ) => void;
};

type CtaBlock = BlockFor<"cta">;

const ctaDefaultVariant: CtaBlock["variant"] = "primary";
const ctaDefaultProps = {
  presetId: undefined,
  label: "",
  href: "/apply",
  trackingName: "",
} satisfies CtaBlock["props"];

function ctaProps(): CtaBlock["props"] {
  return { ...ctaDefaultProps };
}

export const ctaBlockDescriptor = {
  type: "cta",
  label: "CTA",
  description: "Primary conversion button.",
  variants: [
    {
      id: "primary",
      label: "Primary CTA",
      description: "Main conversion action.",
    },
    {
      id: "secondary",
      label: "Secondary CTA",
      description: "Lower-emphasis conversion action.",
    },
    {
      id: "text",
      label: "Text link CTA",
      description: "Inline supporting action.",
    },
  ],
  defaultVariant: ctaDefaultVariant,
  defaultProps: ctaDefaultProps,
  optionalFields: [],
  defaultFieldVisibility: {},
  editor: {
    canvasPlaceholders: {
      label: "CTA label",
    },
    publicRenderer: "CtaBlock",
  },
  createBlock(id) {
    return {
      id,
      type: "cta",
      variant: ctaDefaultVariant,
      props: ctaProps(),
    };
  },
  createPreviewBlock(id, variant) {
    return {
      id,
      type: "cta",
      variant,
      props: {
        label:
          variant === "text" ? "Read the application guide" : "Apply today",
        href: "/apply",
        trackingName: `preview-${variant}-cta`,
      },
    };
  },
  addParityMarkers(block, { addText }) {
    addText("label", block.props.label);
  },
} as const satisfies PageBlockDescriptor<"cta">;

export const blockDescriptorPilots = {
  cta: ctaBlockDescriptor,
} as const;

export function createDescriptorPageBlock(
  type: PageBlock["type"],
  id: string,
): PageBlock | undefined {
  if (type === ctaBlockDescriptor.type) {
    return ctaBlockDescriptor.createBlock(id);
  }
  return undefined;
}

function isCtaVariant(
  variant: PageBlock["variant"],
): variant is CtaBlock["variant"] {
  return ctaBlockDescriptor.variants.some((option) => option.id === variant);
}

export function createDescriptorPreviewBlock(
  type: PageBlock["type"],
  id: string,
  variant: PageBlock["variant"],
): PageBlock | undefined {
  if (type === ctaBlockDescriptor.type) {
    if (!isCtaVariant(variant)) return undefined;
    return ctaBlockDescriptor.createPreviewBlock(id, variant);
  }
  return undefined;
}

export function descriptorDefaultFieldVisibility(
  block: Pick<PageBlock, "type" | "variant">,
): Partial<Record<OptionalBlockFieldKey, boolean>> | undefined {
  if (block.type === ctaBlockDescriptor.type) {
    return ctaBlockDescriptor.defaultFieldVisibility;
  }
  return undefined;
}

export function addDescriptorParityMarkers(
  block: PageBlock,
  adders: BlockParityMarkerAdders,
) {
  if (block.type !== ctaBlockDescriptor.type) return false;
  ctaBlockDescriptor.addParityMarkers(block, adders);
  return true;
}
