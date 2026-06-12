import type {
  PageBuilderAiChatRequest,
  PageBuilderAiContext,
} from "@/lib/page-builder/ai-chat";
import type { SeoAgentSourceBundle } from "@/lib/services/openai-seo-agent";

const blankContext: PageBuilderAiContext = {
  pageId: null,
  status: "draft",
  title: "",
  slug: "",
  pageType: "resource",
  templateKey: "blank",
  targetKeyword: "coffee vending machines for offices",
  seoTitle: "",
  metaDescription: "",
  selectedBlockId: null,
  content: { version: 1, sections: [] },
  publishReadiness: {
    blockers: ["Publish requires at least one CTA or lead form block."],
    warnings: [],
    opportunities: [],
  },
};

const heroPageContext: PageBuilderAiContext = {
  pageId: "11111111-1111-4111-8111-111111111111",
  status: "draft",
  title: "Coffee vending for offices",
  slug: "coffee-vending-offices",
  pageType: "resource",
  templateKey: "blank",
  targetKeyword: "coffee vending machines for offices",
  seoTitle: "Coffee vending for offices",
  metaDescription: "Coffee vending machines for modern workplaces.",
  selectedBlockId: "block_hero",
  content: {
    version: 1,
    sections: [
      {
        id: "section_1",
        preset: "standard",
        background: "default",
        spacing: "standard",
        columns: [
          {
            id: "column_1",
            width: "1/1",
            blocks: [
              {
                id: "block_hero",
                type: "hero",
                variant: "standard",
                props: {
                  eyebrow: "",
                  heading: "Old headline",
                  // Long enough to pass the copy gate so fragment-task gate
                  // results reflect only the blocks the model touched.
                  body: "Coffee vending machines for offices keep teams stocked with fresh drinks without anyone owning a brewing rota. A managed machine covers restocking, cleaning, and fault response so facilities can stay focused on the building.",
                  ctaLabel: "Apply now",
                  ctaHref: "/apply",
                  ctaTrackingName: "apply-now",
                  mediaSrc: "",
                  mediaAltText: "",
                  mediaCaption: "",
                  proofText: "",
                },
              },
            ],
          },
        ],
      },
    ],
  },
  publishReadiness: { blockers: [], warnings: [], opportunities: [] },
};

export type ChatTask = {
  key: string;
  context: PageBuilderAiContext;
  prompt: string;
  // Pass when at least one tool call matches one of these names/prefixes.
  expectAnyTool: string[];
  minApplied: number;
  expectClarification?: boolean;
  // When set, run assessSeoCopyQuality on the applied content at this scope.
  gateScope?: "page" | "fragment";
};

export const chatTasks: ChatTask[] = [
  {
    key: "draft-blank-page",
    context: blankContext,
    prompt:
      "Create a complete draft for this page targeting 'coffee vending machines for offices'. Include a hero, a benefits section, an FAQ, and a closing CTA.",
    expectAnyTool: ["replace_page_sections", "add_block"],
    minApplied: 1,
    gateScope: "page",
  },
  {
    key: "hero-rewrite",
    context: heroPageContext,
    prompt:
      "Rewrite the hero headline and body to emphasise hands-off passive income for busy professionals. Keep the CTA unchanged.",
    expectAnyTool: ["edit_block_1_block_hero"],
    minApplied: 1,
    gateScope: "fragment",
  },
  {
    key: "faq-add",
    context: heroPageContext,
    prompt:
      "Add an FAQ section with 4 common questions people ask before starting a vending machine business.",
    expectAnyTool: ["add_block", "replace_page_sections"],
    minApplied: 1,
    gateScope: "fragment",
  },
  {
    key: "seo-metadata",
    context: heroPageContext,
    prompt:
      "Set an SEO title and meta description optimised for the target keyword 'coffee vending machines for offices'.",
    expectAnyTool: ["set_seo_metadata"],
    minApplied: 1,
  },
  {
    key: "vague-image-ask",
    context: heroPageContext,
    prompt: "Add an image section with text about campus vending.",
    expectAnyTool: ["request_clarification", "add_image_text_section"],
    minApplied: 0,
    expectClarification: true,
  },
];

export function chatRequestForTask(task: ChatTask): PageBuilderAiChatRequest {
  return {
    messages: [{ role: "user", content: task.prompt }],
    context: task.context,
  };
}

const documentId = "11111111-1111-4111-8111-111111111111";
const excerptId = "22222222-2222-4222-8222-222222222222";
const claimId = "33333333-3333-4333-8333-333333333333";

export const proposalPage = {
  id: "44444444-4444-4444-8444-444444444444",
  slug: "start-vending",
  status: "draft",
  title: "Start a Vending Business",
  target_keyword: "start vending business",
  seo_title: "Start a Vending Business",
  meta_description: "Learn how to start a vending business with support.",
  draft_content: { version: 1, sections: [] },
};

export const proposalSourceBundle: SeoAgentSourceBundle = {
  documents: [
    {
      id: documentId,
      title: "Approved vending starter source",
      source_type: "paste",
      tags: ["vending", "startup"],
    },
  ],
  excerpts: [
    {
      id: excerptId,
      source_document_id: documentId,
      excerpt:
        "New vending operators should validate location demand before buying machines. Foot traffic, dwell time, and existing food options are the strongest demand signals.",
      topic_tags: ["vending", "locations"],
      updated_at: "2026-05-06T00:00:00.000Z",
    },
  ],
  approvedClaims: [
    {
      id: claimId,
      claim:
        "Operators should validate location demand before buying machines.",
      claim_type: "guidance",
      source_excerpt_id: excerptId,
      usage_notes: "Use as practical startup advice.",
      risk_level: "low",
    },
  ],
};

export const proposalSourceIds = {
  documentIds: [documentId],
  excerptIds: [excerptId],
  claimIds: [claimId],
};
