import "server-only";

import { z } from "zod";
import type { PageGuideSelection } from "@/lib/page-builder/ai-page-guides";
import {
  addBlockInputSchema,
  imageTextSectionClarificationOptions,
  mediaSourceClarificationOptions,
  type AiAddBlockType,
  type PageBuilderAiContext,
  type PageBuilderAiToolCall,
} from "@/lib/page-builder/ai-chat";

export function imageTextSectionClarificationToolCall(): PageBuilderAiToolCall {
  return {
    id: "deterministic_image_text_clarification",
    name: "request_clarification",
    input: { options: imageTextSectionClarificationOptions },
  };
}

export function addImageTextSectionToolCall(
  topic: string,
  imageUrl: string,
): PageBuilderAiToolCall {
  const mediaTopic = mediaSupportTopic(topic);
  return {
    id: "deterministic_add_image_text_section",
    name: "add_image_text_section",
    input: {
      heading: titleWithTopic(mediaTopic, "Useful context"),
      body: bodyForTopic(mediaTopic),
      bulletItems: null,
      imageUrl,
      imageAltText: titleWithTopic(mediaTopic, "Supporting image"),
      imageCaption: null,
      sourceRightsNotes: null,
      imagePosition: "right",
    },
  };
}

export function mediaSourceClarificationToolCall(): PageBuilderAiToolCall {
  return {
    id: "deterministic_media_source_clarification",
    name: "request_clarification",
    input: { options: mediaSourceClarificationOptions },
  };
}

export function addMediaBlockToolCall(
  mediaType: "image" | "video",
  topic: string,
  mediaUrl: string,
): PageBuilderAiToolCall {
  return {
    id: `deterministic_add_${mediaType}_block`,
    name: "add_media_block",
    input: {
      mediaType,
      title: mediaType === "video" ? titleWithTopic(topic, "Video") : null,
      url: mediaUrl,
      altText: mediaType === "image" ? titleWithTopic(topic, "Image") : null,
      caption: null,
      sourceRightsNotes: null,
    },
  };
}

export function addBlockFallbackToolCall(
  blockType: AiAddBlockType,
  message: string,
  context: PageBuilderAiContext,
): PageBuilderAiToolCall {
  return {
    id: `deterministic_add_${blockType}`,
    name: "add_block",
    input: fallbackAddBlockInput(blockType, message, context),
  };
}

export function completePageDraftToolCall(
  topic: string,
  pageGuide: PageGuideSelection,
  replaceExisting = false,
): PageBuilderAiToolCall {
  const pageTopic = titleWithTopic(topic, "this page");
  return {
    id: "deterministic_replace_page_sections",
    name: "replace_page_sections",
    input: {
      replaceExisting,
      sections: completePageDraftSections(pageTopic, pageGuide),
    },
  };
}

export function completePageDraftSeoMetadataToolCall(
  topic: string,
  context: PageBuilderAiContext,
): PageBuilderAiToolCall {
  const targetKeyword = cleanTopic(context.targetKeyword) || cleanTopic(topic);
  const displayTopic = titleWithTopic(
    cleanTopic(topic) || targetKeyword,
    "SEO page",
  );
  return {
    id: "deterministic_set_seo_metadata",
    name: "set_seo_metadata",
    input: {
      title: displayTopic,
      slug: targetKeyword,
      targetKeyword,
      seoTitle: displayTopic,
      metaDescription: `${targetKeyword} planning: compare site fit, product range, refills, and support before booking a vending consultation.`,
    },
  };
}

function completePageDraftSections(
  pageTopic: string,
  pageGuide: PageGuideSelection,
) {
  if (pageGuide.primaryGuide === "how-to-guide") {
    return [
      heroDraftSection(pageTopic),
      richTextDraftSection(
        pageTopic,
        "Planning steps before launch",
        [
          "Clarify who will use the site and when demand peaks",
          "Confirm space, access, power, payment, and refill needs",
          "Agree the enquiry details before a recommendation is made",
        ],
        "process",
      ),
      cardGridDraftSection(pageTopic, "Planning decisions"),
      richTextDraftSection(
        pageTopic,
        "What to confirm before launch",
        [
          "Product range and dietary expectations",
          "Restocking cadence and issue response",
          "How success will be reviewed after launch",
        ],
        "fit",
      ),
      faqDraftSection(pageTopic),
      ctaDraftSection(pageTopic),
    ];
  }

  if (pageGuide.primaryGuide === "comparison") {
    return [
      heroDraftSection(pageTopic),
      richTextDraftSection(
        pageTopic,
        "Choosing the right vending format",
        [
          "Compare site size, staffing, space, and daily traffic",
          "Check how much product choice the audience expects",
          "Match the format to support and restocking needs",
        ],
        "comparison",
      ),
      cardGridDraftSection(pageTopic, "Comparison criteria"),
      richTextDraftSection(
        pageTopic,
        "Service questions that change the recommendation",
        [
          "Access and payment requirements",
          "Refill frequency and waste risk",
          "Support expectations after installation",
        ],
        "implementation",
      ),
      faqDraftSection(pageTopic),
      ctaDraftSection(pageTopic),
    ];
  }

  if (pageGuide.primaryGuide === "use-case") {
    return [
      heroDraftSection(pageTopic),
      richTextDraftSection(
        pageTopic,
        "What the location needs from vending",
        [
          "Map the audience, peak demand, and available space",
          "Decide how much fresh food, drinks, and snacks are needed",
          "Confirm who owns restocking, service issues, and reviews",
        ],
        "overview",
      ),
      cardGridDraftSection(pageTopic, "Decisions before launch"),
      richTextDraftSection(
        pageTopic,
        "Rollout and support plan",
        [
          "Confirm site constraints before recommending equipment",
          "Plan refills around real usage patterns",
          "Review product mix after the setup has live feedback",
        ],
        "implementation",
      ),
      faqDraftSection(pageTopic),
      ctaDraftSection(pageTopic),
    ];
  }

  if (pageGuide.primaryGuide === "local-intent") {
    return [
      heroDraftSection(pageTopic),
      richTextDraftSection(
        pageTopic,
        "Service fit for local sites",
        [
          "Explain local fit without promising unsupported coverage",
          "Clarify access, restocking, and response expectations",
          "Invite the reader to confirm site details",
        ],
        "local",
      ),
      cardGridDraftSection(pageTopic, "Local planning checks"),
      richTextDraftSection(
        pageTopic,
        "How the enquiry should be scoped",
        [
          "Site type, staff count, and visitor flow",
          "Preferred products and payment needs",
          "Refill access and service contact expectations",
        ],
        "process",
      ),
      faqDraftSection(pageTopic),
      ctaDraftSection(pageTopic),
    ];
  }

  return [
    heroDraftSection(pageTopic),
    richTextDraftSection(
      pageTopic,
      "What buyers need to know first",
      [
        "Who will use the setup and why",
        "What the service needs to include",
        "Which questions should be settled before launch",
      ],
      "overview",
    ),
    cardGridDraftSection(pageTopic, "Decision points"),
    richTextDraftSection(
      pageTopic,
      "Process and support expectations",
      [
        "Confirm site requirements",
        "Plan stock and refills",
        "Review support after launch",
      ],
      "implementation",
    ),
    faqDraftSection(pageTopic),
    ctaDraftSection(pageTopic),
  ];
}

function heroDraftSection(pageTopic: string) {
  return {
    title: "Hero",
    blocks: [
      {
        blockType: "hero" as const,
        title: titleWithTopic(pageTopic, "Better vending"),
        body: bodyForTopic(pageTopic, "hero"),
        bulletItems: null,
        faqItems: null,
        cards: null,
        ctaLabel: "Book a consultation",
        ctaHref: "/contact",
      },
    ],
  };
}

function richTextDraftSection(
  pageTopic: string,
  title: string,
  bulletItems: string[],
  angle: DraftCopyAngle = "overview",
) {
  return {
    title,
    blocks: [
      {
        blockType: "rich_text" as const,
        title,
        body: bodyForTopic(pageTopic, angle),
        bulletItems,
        faqItems: null,
        cards: null,
        ctaLabel: null,
        ctaHref: null,
      },
    ],
  };
}

function cardGridDraftSection(pageTopic: string, title: string) {
  return {
    title,
    blocks: [
      {
        blockType: "card_grid" as const,
        title,
        body: null,
        bulletItems: null,
        faqItems: null,
        cards: [
          {
            title: "Site fit",
            body: bodyForTopic(pageTopic, "siteFit"),
            href: "/contact",
            linkLabel: "Check site fit",
          },
          {
            title: "Product range",
            body: bodyForTopic(pageTopic, "productRange"),
            href: "/contact",
            linkLabel: "Plan the range",
          },
          {
            title: "Payment and access",
            body: bodyForTopic(pageTopic, "paymentAccess"),
            href: "/contact",
            linkLabel: "Review access",
          },
          {
            title: "Restocking plan",
            body: bodyForTopic(pageTopic, "restockingPlan"),
            href: "/contact",
            linkLabel: "Scope refills",
          },
          {
            title: "Support expectations",
            body: bodyForTopic(pageTopic, "supportExpectations"),
            href: "/contact",
            linkLabel: "Discuss support",
          },
        ],
        ctaLabel: null,
        ctaHref: null,
      },
    ],
  };
}

function faqDraftSection(pageTopic: string) {
  return {
    title: "FAQs",
    blocks: [
      {
        blockType: "faq" as const,
        title: titleWithTopic(pageTopic, "FAQs"),
        body: null,
        bulletItems: null,
        faqItems: [
          {
            question: "What makes this setup a good fit?",
            answer: bodyForTopic(pageTopic, "faq"),
          },
          {
            question: "What needs to be confirmed before launch?",
            answer:
              "Walk the site and confirm available space, power access, and how refill visits will get in. Then settle the people questions: who approves the placement, who owns day-to-day contact, and what payment options the audience actually needs.",
          },
          {
            question: "How should products and refills be planned?",
            answer:
              "Map expected daily usage to a starting product list, then agree who reviews what is selling and how often refills happen. Most sites settle into a weekly or fortnightly cadence once real demand is visible, so build the first plan around easy adjustment rather than a fixed menu.",
          },
          {
            question: "Who handles service issues after launch?",
            answer:
              "Agree a single reporting contact and a response window for faults before launch. Clear escalation expectations stop small problems like payment errors or stock gaps from sitting unresolved, and they make it obvious whether the service plan or the site team owns each task.",
          },
          {
            question: "How do we get started?",
            answer:
              "Start with a quick consultation that covers the site type, audience, available space, product preferences, and support expectations. Those details make it easier to recommend a practical setup instead of guessing from a generic vending checklist.",
          },
        ],
        cards: null,
        ctaLabel: null,
        ctaHref: null,
      },
    ],
  };
}

function ctaDraftSection(pageTopic: string) {
  return {
    title: "CTA",
    blocks: [
      {
        blockType: "cta" as const,
        title: "Ready to plan the setup?",
        body: bodyForTopic(pageTopic, "cta"),
        bulletItems: null,
        faqItems: null,
        cards: null,
        ctaLabel: "Book a consultation",
        ctaHref: "/contact",
      },
    ],
  };
}

function fallbackAddBlockInput(
  blockType: AiAddBlockType,
  message: string,
  context: PageBuilderAiContext,
): z.infer<typeof addBlockInputSchema> {
  const topic = intentTopic(message, context);
  const base = {
    blockType,
    title: null,
    body: null,
    bulletItems: null,
    faqItems: null,
    cards: null,
    ctaLabel: null,
    ctaHref: null,
  };

  if (blockType === "hero") {
    return {
      ...base,
      title: titleWithTopic(topic, "Better vending"),
      body: bodyForTopic(topic, "hero"),
      ctaLabel: "Book a consultation",
      ctaHref: "/contact",
    };
  }

  if (blockType === "rich_text") {
    return {
      ...base,
      title: titleWithTopic(topic, "What to know"),
      body: bodyForTopic(topic),
      bulletItems: ["Clarify the audience", "Explain the benefit"],
    };
  }

  if (blockType === "faq") {
    return {
      ...base,
      title: titleWithTopic(topic, "FAQs"),
      faqItems: [
        {
          question: questionForTopic(topic),
          answer: bodyForTopic(topic),
        },
      ],
    };
  }

  if (blockType === "card_grid") {
    return {
      ...base,
      title: titleWithTopic(topic, "Options"),
      cards: [
        {
          title: "Managed setup",
          body: bodyForTopic(topic),
          href: "/contact",
          linkLabel: "Ask about this option",
        },
      ],
    };
  }

  if (blockType === "cta") {
    return {
      ...base,
      ctaLabel: titleWithTopic(topic, "Talk to us"),
      ctaHref: "/contact",
    };
  }

  if (blockType === "proof") {
    return {
      ...base,
      title: "Proof point",
      body: `Use this proof block to support ${topic}.`,
    };
  }

  return {
    ...base,
    title: titleWithTopic(topic, "Enquire"),
    body: `Share a few details and we will help with ${topic}.`,
    ctaLabel: "Send enquiry",
  };
}

export function intentTopic(message: string, context: PageBuilderAiContext) {
  const targetKeywordMatch = message.match(
    /\btarget keyword\s*:\s*([^.,;!?]+)/i,
  )?.[1];
  const topicMatch = message.match(
    /\b(?:about|for|on|around)\s+([^.,;!?]+)/i,
  )?.[1];
  const contextKeyword = cleanTopic(context.targetKeyword);
  const topicWithAudience = topicMatch
    ? topicWithAudienceForKeyword(topicMatch, contextKeyword)
    : "";
  const source =
    (targetKeywordMatch && topicWithAudience
      ? topicWithAudience
      : cleanTopic(targetKeywordMatch ?? "")) ||
    (contextKeyword &&
    message.toLowerCase().includes(contextKeyword.toLowerCase())
      ? topicWithAudience || contextKeyword
      : "") ||
    topicWithAudience ||
    cleanTopic(topicMatch ?? "") ||
    contextKeyword ||
    cleanTopic(context.title) ||
    "this page";
  return source.slice(0, 90);
}

function topicWithAudienceForKeyword(topic: string, keyword: string) {
  const cleanedTopic = cleanTopic(topic);
  const cleanedKeyword = cleanTopic(keyword);
  if (!cleanedTopic || !cleanedKeyword) return "";
  const lowerTopic = cleanedTopic.toLowerCase();
  const lowerKeyword = cleanedKeyword.toLowerCase();
  if (!lowerTopic.includes(lowerKeyword)) return "";

  const audience = [
    "office managers",
    "facilities managers",
    "workplace managers",
    "property managers",
    "school administrators",
    "campus operators",
    "gym owners",
    "warehouse managers",
    "hotel managers",
  ].find((candidate) => lowerTopic.includes(candidate));

  return audience ? `${cleanedKeyword} for ${audience}` : cleanedKeyword;
}

function cleanTopic(value: string) {
  return value
    .replace(/\busing\s+(?:https?:\/\/|\/)\S+/i, "")
    .replace(/\bwith\s+(?:https?:\/\/|\/)\S+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleWithTopic(topic: string, fallback: string) {
  const cleaned = cleanTopic(topic);
  if (!cleaned) return fallback;
  const display = titleCaseTopic(cleaned);
  return display.length > 120
    ? display.slice(0, 117).trimEnd() + "..."
    : display;
}

function mediaSupportTopic(topic: string) {
  const cleaned = cleanTopic(topic);
  if (!cleaned) return "office vending planning";
  return cleaned
    .replace(
      /\bmicro market vending\s+([A-Za-z]+)\b/gi,
      "$1 office micro market planning",
    )
    .replace(/\bvending machines?\s+([A-Za-z ]+)\b/gi, "$1 vending planning")
    .replace(/\s+/g, " ")
    .trim();
}

type DraftCopyAngle =
  | "hero"
  | "overview"
  | "fit"
  | "process"
  | "implementation"
  | "local"
  | "comparison"
  | "siteFit"
  | "productRange"
  | "paymentAccess"
  | "restockingPlan"
  | "supportExpectations"
  | "faq"
  | "cta";

function bodyForTopic(topic: string, angle: DraftCopyAngle = "overview") {
  const cleaned = cleanTopic(topic) || "this page";
  const audience = audienceContextForTopic(cleaned);
  const displayTopic = sentenceCaseTopic(cleaned);
  const serviceLabel = serviceLabelForTopic(cleaned);
  const siteLabel = siteLabelForTopic(cleaned);

  if (angle === "hero") {
    return `${displayTopic} helps ${audience} access food, drinks, and everyday refreshments without turning the site team into an informal catering desk. A managed plan covers placement, product range, restocking cadence, and issue response so the site keeps running between visits.`;
  }

  if (angle === "fit") {
    return `Before recommending a setup, confirm the daily audience, available floor space, power access, payment expectations, and who can provide service access. Those details shape whether ${serviceLabel} is practical for the site or whether a simpler vending format would be easier to manage.`;
  }

  if (angle === "process" || angle === "implementation") {
    return `A practical rollout starts with the site, audience, and service needs, then turns those details into an equipment recommendation, product plan, restocking cadence, and issue-response path. The strongest enquiry includes photos or notes about the space, expected usage windows, and any access constraints for refills.`;
  }

  if (angle === "local") {
    return `Local buyers need to know whether the service model can fit their site, how restocking access is handled, and what information is needed before availability can be confirmed. Keep location copy practical and avoid promising coverage, timing, or service levels until the site has been reviewed.`;
  }

  if (angle === "comparison") {
    return `The useful comparison is not just machine versus machine. It weighs space, staffing, expected traffic, product variety, payment needs, freshness expectations, and how much ongoing maintenance the site is willing to coordinate.`;
  }

  if (angle === "siteFit") {
    return `${serviceLabel} usually works best where there is steady daily traffic, enough room for people to browse, and clear access for refills. Smaller or irregular sites may still work, but they need a tighter product range and a simpler service plan.`;
  }

  if (angle === "productRange") {
    return `Plan the range around what people actually buy during the day: quick lunches, drinks, snacks, coffee, healthier choices, and any site-specific preferences. Review the mix after launch so slow-moving products do not crowd out better options.`;
  }

  if (angle === "paymentAccess") {
    return `Confirm how people will pay, where the equipment can sit, and whether visitors as well as staff need access. Access rules affect placement, signage, product choice, and how easy the service is to use during busy periods.`;
  }

  if (angle === "restockingPlan") {
    return `Restocking should match the site's usage pattern rather than a generic schedule. Ask about staff numbers, busy days, preferred product types, and who can provide access so the refill plan supports demand without overstocking.`;
  }

  if (angle === "supportExpectations") {
    return `Set expectations for machine issues, product changes, cleaning responsibilities, and who the site contacts when something is not working. Clear support ownership is what keeps the setup useful after the first week.`;
  }

  if (angle === "faq") {
    return `A good fit depends on the audience, space, access, product expectations, and service model. For ${cleaned}, the useful next step is to compare the site details against those requirements before promising a machine mix or rollout plan.`;
  }

  if (angle === "cta") {
    return `Share the ${siteLabel} type, estimated daily audience, available space, and preferred product categories so the next recommendation can be scoped around real conditions rather than generic vending assumptions.`;
  }

  return `For ${cleaned}, buyers need more than a list of benefits. Explain when the service is a good fit, what products and support are included, what the site needs to provide, and how the enquiry turns into a practical recommendation.`;
}

function questionForTopic(topic: string) {
  return `What should readers know about ${cleanTopic(topic) || "this page"}?`;
}

function sentenceCaseTopic(topic: string) {
  const cleaned = cleanTopic(topic);
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function titleCaseTopic(topic: string) {
  const smallWords = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "for",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
  ]);
  return cleanTopic(topic)
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && smallWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function audienceContextForTopic(topic: string) {
  const text = topic.toLowerCase();

  if (/\b(universit\w*|college|campus|dorm|student|school)\b/.test(text)) {
    return "students, staff, and campus visitors";
  }

  if (/\b(warehouse|distribution|logistics)\b/.test(text)) {
    return "shift teams and visitors";
  }

  if (/\b(factory|factories|manufacturing|industrial)\b/.test(text)) {
    return "shift workers and site visitors";
  }

  if (/\b(office|workplace|staff room|staff rooms|corporate)\b/.test(text)) {
    return "staff and visitors";
  }

  if (/\bmicro market\b/.test(text)) {
    return "staff and visitors";
  }

  if (/\b(gym|fitness|health club)\b/.test(text)) {
    return "members and staff";
  }

  return "site users";
}

function serviceLabelForTopic(topic: string) {
  const text = topic.toLowerCase();
  if (/\bmicro market\b/.test(text)) return "a micro market";
  if (/\bcoffee\b/.test(text)) return "coffee vending";
  if (/\bhealthy\b/.test(text)) return "healthy vending";
  if (/\bvending\b/.test(text)) return "a vending setup";
  return "the service";
}

function siteLabelForTopic(topic: string) {
  const text = topic.toLowerCase();
  if (/\b(universit\w*|college|campus|dorm|student|school)\b/.test(text)) {
    return "campus";
  }
  if (/\b(office|workplace|staff room|staff rooms|corporate)\b/.test(text)) {
    return "workplace";
  }
  if (/\b(gym|fitness|health club)\b/.test(text)) return "fitness site";
  if (/\b(hospital|clinic|healthcare)\b/.test(text)) {
    return "healthcare site";
  }
  if (/\b(hotel|apartment|residential)\b/.test(text)) return "property";
  if (/\b(warehouse|factory|industrial|distribution|logistics)\b/.test(text)) {
    return "worksite";
  }
  return "site";
}
