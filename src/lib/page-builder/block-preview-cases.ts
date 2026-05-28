import {
  cardGridLinkLabel,
  pageContentSchema,
  type PageBlock,
  type PageContent,
  type RichTextNode,
} from "@/lib/page-builder/blocks";
import { isBlockFieldVisible } from "@/lib/page-builder/block-field-visibility";
import {
  blockPickerOptions,
  type BlockPickerOption,
  type BlockVariant,
} from "@/lib/page-builder/block-options";

export type BlockPreviewParityMarker =
  | { kind: "text"; label: string; value: string }
  | { kind: "img-alt"; label: string; value: string };

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

/** Strings that should appear in both picker preview and actual resource render. */
export function getBlockPreviewParityMarkers(
  block: PageBlock,
): BlockPreviewParityMarker[] {
  const markers: BlockPreviewParityMarker[] = [];

  const addText = (label: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) {
      markers.push({ kind: "text", label, value: trimmed });
    }
  };

  const addImgAlt = (label: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) {
      markers.push({ kind: "img-alt", label, value: trimmed });
    }
  };

  if (block.type === "hero") {
    if (isBlockFieldVisible(block, "eyebrow")) {
      addText("eyebrow", block.props.eyebrow);
    }
    addText("heading", block.props.heading);
    if (isBlockFieldVisible(block, "body")) {
      addText("body", block.props.body);
    }
    if (isBlockFieldVisible(block, "cta") && block.props.ctaLabel) {
      addText("cta", block.props.ctaLabel);
    }
    if (isBlockFieldVisible(block, "mediaCaption")) {
      addText("mediaCaption", block.props.mediaCaption);
    }
    if (block.props.mediaSrc) {
      addImgAlt("heroMedia", block.props.mediaAltText);
    }
    return markers;
  }

  if (block.type === "rich_text") {
    if (isBlockFieldVisible(block, "eyebrow")) {
      addText("eyebrow", block.props.eyebrow);
    }
    if (isBlockFieldVisible(block, "heading")) {
      addText("heading", block.props.heading);
    }
    for (const text of extractRichTextStrings(block.props.body.nodes)) {
      addText("body", text);
    }
    return markers;
  }

  if (block.type === "image") {
    addImgAlt("altText", block.props.altText);
    if (isBlockFieldVisible(block, "caption")) {
      addText("caption", block.props.caption);
    }
    if (block.variant === "feature") {
      addText("featureLabel", "Featured media");
    }
    return markers;
  }

  if (block.type === "video") {
    if (isBlockFieldVisible(block, "title")) {
      addText("title", block.props.title);
    }
    if (isBlockFieldVisible(block, "caption")) {
      addText("caption", block.props.caption);
    }
    if (block.props.url) {
      addText("watchLink", "Watch video");
    }
    return markers;
  }

  if (block.type === "cta") {
    addText("label", block.props.label);
    return markers;
  }

  if (block.type === "faq") {
    if (isBlockFieldVisible(block, "heading")) {
      addText("heading", block.props.heading);
    }
    for (const item of block.props.items) {
      addText("question", item.question);
      if (block.variant !== "compact") {
        addText("answer", item.answer);
      }
    }
    return markers;
  }

  if (block.type === "card_grid") {
    if (isBlockFieldVisible(block, "heading")) {
      addText("heading", block.props.heading);
    }
    for (const card of block.props.cards) {
      addText("cardTitle", card.title);
      addText("cardBody", card.body);
      if (card.href) {
        addText("cardLink", cardGridLinkLabel(card));
      }
    }
    return markers;
  }

  if (block.type === "proof") {
    if (isBlockFieldVisible(block, "eyebrow")) {
      addText("eyebrow", block.props.eyebrow);
    }
    addText("body", block.props.body);
    if (isBlockFieldVisible(block, "name")) {
      addText("name", block.props.name);
    }
    if (isBlockFieldVisible(block, "context")) {
      addText("context", block.props.context);
    }
    return markers;
  }

  if (block.type === "lead_form") {
    if (isBlockFieldVisible(block, "heading")) {
      addText("heading", block.props.heading);
    }
    if (isBlockFieldVisible(block, "body")) {
      addText("body", block.props.body);
    }
    addText("submitLabel", block.props.submitLabel);
    return markers;
  }

  return markers;
}

function extractRichTextStrings(nodes: RichTextNode[]): string[] {
  const strings: string[] = [];

  for (const node of nodes) {
    if (node.type === "paragraph") {
      if ("text" in node && node.text.trim()) {
        strings.push(node.text.trim());
      }
      continue;
    }

    if (node.type === "list") {
      for (const item of node.items) {
        if (item.trim()) {
          strings.push(item.trim());
        }
      }
    }
  }

  return strings;
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
        body: "Learn how operators plan routes, place machines, and grow recurring revenue from day one.",
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
                text: "Most new operators start with a clear route plan, realistic startup costs, and a short list of target locations.",
              },
              {
                type: "paragraph" as const,
                text: "Use this section to explain the next step, remove objections, and keep the reader moving toward an enquiry.",
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
            ? "Show the route, the machine, or the operator in action."
            : "Supporting image for this section.",
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
          "A short walkthrough of how to evaluate locations and plan your first placements.",
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
