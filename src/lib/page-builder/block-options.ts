import type { PageBlock } from "@/lib/page-builder/blocks";
import { ctaBlockDescriptor } from "@/lib/page-builder/block-descriptors";

export type BlockVariant = PageBlock["variant"];

export type BlockPickerVariantOption = {
  id: BlockVariant;
  label: string;
  description: string;
};

export type BlockPickerOption = {
  type: PageBlock["type"];
  label: string;
  description: string;
  variants: BlockPickerVariantOption[];
};

const ctaPickerOption: BlockPickerOption = {
  type: ctaBlockDescriptor.type,
  label: ctaBlockDescriptor.label,
  description: ctaBlockDescriptor.description,
  variants: ctaBlockDescriptor.variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    description: variant.description,
  })),
};

export const blockPickerOptions: BlockPickerOption[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Opening message with optional CTA.",
    variants: [
      {
        id: "standard",
        label: "Standard hero",
        description: "Headline, intro copy, and one CTA.",
      },
      {
        id: "split",
        label: "Split hero",
        description: "Best for pairing copy with media or proof.",
      },
      {
        id: "compact",
        label: "Compact hero",
        description: "Short page opener for utility pages.",
      },
      {
        id: "editorial",
        label: "Editorial hero",
        description: "Stronger story-led opening for guides.",
      },
    ],
  },
  {
    type: "rich_text",
    label: "Text",
    description: "SEO body copy and supporting sections.",
    variants: [
      {
        id: "default",
        label: "Standard text",
        description: "Heading with paragraph body copy.",
      },
      {
        id: "intro",
        label: "Intro text",
        description: "Lead-in copy after the hero.",
      },
      {
        id: "compact",
        label: "Compact text",
        description: "Short supporting note or bridge.",
      },
      {
        id: "checklist",
        label: "Checklist text",
        description: "Structured copy for steps or inclusions.",
      },
    ],
  },
  {
    type: "image",
    label: "Image",
    description: "Media asset with alt text and rights notes.",
    variants: [
      {
        id: "standard",
        label: "Standard image",
        description: "Inline image with caption.",
      },
      {
        id: "wide",
        label: "Wide image",
        description: "Full-width visual break.",
      },
      {
        id: "inline",
        label: "Inline image",
        description: "Smaller supporting image.",
      },
      {
        id: "feature",
        label: "Feature image",
        description: "Prominent image for split sections.",
      },
    ],
  },
  ctaPickerOption,
  {
    type: "faq",
    label: "FAQ",
    description: "Visible Q&A for schema.",
    variants: [
      {
        id: "standard",
        label: "Standard FAQ",
        description: "Question list for answer pages.",
      },
      {
        id: "compact",
        label: "Compact FAQ",
        description: "Short objection-handling section.",
      },
      {
        id: "accordion",
        label: "Accordion FAQ",
        description: "Expandable-style question group.",
      },
    ],
  },
  {
    type: "card_grid",
    label: "Cards",
    description: "Comparison cards or grouped options.",
    variants: [
      {
        id: "standard",
        label: "Standard cards",
        description: "Balanced grid for grouped details.",
      },
      {
        id: "compact",
        label: "Compact cards",
        description: "Dense scannable comparison points.",
      },
      {
        id: "feature",
        label: "Feature cards",
        description: "Bigger cards for key offers.",
      },
    ],
  },
  {
    type: "proof",
    label: "Proof",
    description: "Approved testimonial, stat, or evidence.",
    variants: [
      {
        id: "quote",
        label: "Quote proof",
        description: "Customer or source-backed quote.",
      },
      {
        id: "stat",
        label: "Stat proof",
        description: "Number-led credibility point.",
      },
      {
        id: "logo",
        label: "Logo proof",
        description: "Source, partner, or trust marker.",
      },
    ],
  },
  {
    type: "video",
    label: "Video",
    description: "Embedded or linked video.",
    variants: [
      {
        id: "standard",
        label: "Standard video",
        description: "Video with title and caption.",
      },
      {
        id: "wide",
        label: "Wide video",
        description: "Full-width video feature.",
      },
      {
        id: "inline",
        label: "Inline video",
        description: "Smaller video inside supporting copy.",
      },
    ],
  },
  {
    type: "lead_form",
    label: "Form",
    description: "Lead capture with fixed contact fields.",
    variants: [
      {
        id: "standard",
        label: "Standard form",
        description: "Full lead-capture section.",
      },
      {
        id: "compact",
        label: "Compact form",
        description: "Shorter form for simple pages.",
      },
      {
        id: "sidebar",
        label: "Sidebar form",
        description: "Form paired with adjacent content.",
      },
    ],
  },
];
