import {
  pageContentSchema,
  type PageBlock,
  type PageContent,
} from "@/lib/page-builder/blocks";
import {
  blockPickerOptions,
  type BlockPickerOption,
  type BlockVariant,
} from "@/lib/page-builder/block-options";

export type BlockPreviewCase = {
  id: string;
  type: PageBlock["type"];
  variant: BlockVariant;
  blockLabel: string;
  variantLabel: string;
  description: string;
  content: PageContent;
  block: PageBlock;
};

export const blockPreviewCases: BlockPreviewCase[] = blockPickerOptions.flatMap(
  (option) =>
    option.variants.map((variant) => {
      const block = createPreviewBlock(option.type, variant.id);
      const content = createPreviewContent(block);

      return {
        id: `${option.type}-${variant.id}`,
        type: option.type,
        variant: variant.id,
        blockLabel: option.label,
        variantLabel: variant.label,
        description: variant.description,
        content,
        block,
      };
    }),
);

export function getBlockPreviewCase(
  type: PageBlock["type"],
  variant: BlockVariant,
) {
  return blockPreviewCases.find(
    (entry) => entry.type === type && entry.variant === variant,
  );
}

function createPreviewContent(block: PageBlock): PageContent {
  return pageContentSchema.parse({
    version: 1,
    chrome: {
      showHeader: false,
      showFooter: false,
    },
    sections: [
      {
        id: `section_${block.id}`,
        preset: "standard",
        background: "default",
        spacing: "compact",
        columns: [
          {
            id: `column_${block.id}`,
            width: "1/1",
            blocks: [block],
          },
        ],
      },
    ],
  });
}

function createPreviewBlock(
  type: BlockPickerOption["type"],
  variant: BlockVariant,
): PageBlock {
  const id = `block_${type}_${variant}`;

  if (type === "hero") {
    return {
      id,
      type,
      variant: variant as Extract<PageBlock, { type: "hero" }>["variant"],
      props: {
        eyebrow: variant === "compact" ? "Quick guide" : "Resource guide",
        heading:
          variant === "editorial"
            ? "Build a profitable route with fewer wrong turns"
            : "Launch a vending route with a proven plan",
        body: "Use the page builder to turn approved source material into a focused SEO page that converts.",
        ctaLabel: variant === "editorial" ? "" : "Start an enquiry",
        ctaHref: variant === "editorial" ? "" : "/apply",
        ctaTrackingName: variant === "editorial" ? "" : "preview-hero-cta",
        mediaSrc:
          variant === "split" ? "/images/sections/hero.avif" : undefined,
        mediaAltText:
          variant === "split"
            ? "Vending route operator reviewing a location"
            : undefined,
        mediaCaption:
          variant === "split" ? "Approved campaign image." : undefined,
        proofText:
          variant === "split"
            ? "Operators use the same framework to plan locations, costs, and growth."
            : undefined,
      },
    };
  }

  if (type === "rich_text") {
    const body =
      variant === "checklist"
        ? {
            version: 1 as const,
            nodes: [
              {
                type: "list" as const,
                style: "bullet" as const,
                items: [
                  "Choose a route strategy",
                  "Validate startup costs",
                  "Plan the first outreach run",
                ],
              },
            ],
          }
        : {
            version: 1 as const,
            nodes: [
              {
                type: "paragraph" as const,
                text: "This block gives marketers structured copy without exposing raw schema or freeform HTML.",
              },
              {
                type: "paragraph" as const,
                text: "The same content model feeds the picker preview, editor canvas, and public resource page.",
              },
            ],
          };

    return {
      id,
      type,
      variant: variant as Extract<PageBlock, { type: "rich_text" }>["variant"],
      props: {
        eyebrow: variant === "compact" ? "" : "Plan",
        heading:
          variant === "checklist"
            ? "What the page should include"
            : "Write structured page copy",
        body,
      },
    };
  }

  if (type === "image") {
    return {
      id,
      type,
      variant: variant as Extract<PageBlock, { type: "image" }>["variant"],
      props: {
        src: "/images/sections/hero.avif",
        altText: "Vending route operator reviewing a location",
        caption:
          variant === "feature"
            ? "Use feature media when the visual needs supporting copy."
            : "Approved page-builder media with caption.",
        sourceRightsNotes: "Owned Vendingpreneurs campaign image.",
      },
    };
  }

  if (type === "video") {
    return {
      id,
      type,
      variant: variant as Extract<PageBlock, { type: "video" }>["variant"],
      props: {
        title: "Watch the route planning walkthrough",
        url: "https://example.com/resource-video",
        caption:
          "A supporting video block can sit wide, standard, or inline with copy.",
      },
    };
  }

  if (type === "cta") {
    return {
      id,
      type,
      variant: variant as Extract<PageBlock, { type: "cta" }>["variant"],
      props: {
        label:
          variant === "text" ? "Read the application guide" : "Apply today",
        href: "/apply",
        trackingName: `preview-${variant}-cta`,
      },
    };
  }

  if (type === "faq") {
    return {
      id,
      type,
      variant: variant as Extract<PageBlock, { type: "faq" }>["variant"],
      props: {
        heading: "Common vending questions",
        items: [
          {
            question: "How much budget should I plan for?",
            answer:
              "Most operators need to account for machines, stock, placement, and working capital before launch.",
          },
          {
            question: "Can I start while working another job?",
            answer:
              "Yes, but the plan should define outreach, servicing, and restocking time before commitments are made.",
          },
          {
            question: "What makes a good first location?",
            answer:
              "Good locations have repeat traffic, clear operator access, and a product mix that matches the audience.",
          },
        ],
      },
    };
  }

  if (type === "card_grid") {
    return {
      id,
      type,
      variant: variant as Extract<PageBlock, { type: "card_grid" }>["variant"],
      props: {
        heading: "Compare the next steps",
        cards: [
          {
            title: "Plan",
            body: "Define the route model and startup assumptions.",
            href: "/resources/plan",
          },
          {
            title: "Place",
            body: "Build a location outreach list and pitch.",
            href: "/resources/location",
          },
          {
            title: "Launch",
            body: "Install, stock, and track the early route.",
            href: "/resources/launch",
          },
          {
            title: "Improve",
            body: "Use sales feedback to adjust products and cadence.",
            href: "/resources/improve",
          },
        ],
      },
    };
  }

  if (type === "proof") {
    return {
      id,
      type,
      variant: variant as Extract<PageBlock, { type: "proof" }>["variant"],
      props: {
        eyebrow: variant === "quote" ? "Operator proof" : "Proof",
        body:
          variant === "stat"
            ? "90 days"
            : variant === "logo"
              ? "Vendingpreneurs"
              : "The framework helped us understand locations, costs, and the first real route decisions.",
        name: variant === "logo" ? "Training" : "Vending operator",
        context: variant === "logo" ? "Suppliers" : "Route planning cohort",
      },
    };
  }

  return {
    id,
    type: "lead_form",
    variant: variant as Extract<PageBlock, { type: "lead_form" }>["variant"],
    props: {
      heading: "Start your vending plan",
      body: "Share your goals and we will point you toward the right next step.",
      submitLabel: "Request guidance",
      trackingName: `preview-${variant}-lead-form`,
    },
  };
}
