import { describe, expect, it, vi } from "vitest";
import {
  SeoAgentConfigurationError,
  SeoAgentGenerationError,
  generateOpenAiSeoProposalFromSources,
  type SeoAgentSourceBundle,
} from "./openai-seo-agent";

const documentId = "11111111-1111-4111-8111-111111111111";
const excerptId = "22222222-2222-4222-8222-222222222222";
const claimId = "33333333-3333-4333-8333-333333333333";

const page = {
  id: "44444444-4444-4444-8444-444444444444",
  slug: "start-vending",
  status: "draft",
  title: "Start a Vending Business",
  target_keyword: "start vending business",
  seo_title: "Start a Vending Business",
  meta_description: "Learn how to start a vending business with support.",
  draft_content: { version: 1, sections: [] },
};

const sourceBundle: SeoAgentSourceBundle = {
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
        "New vending operators should validate location demand before buying machines.",
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

const proposal = {
  version: 1,
  metadata: {
    title: "Start a Vending Business",
    seoTitle: "Start a Vending Business",
    metaDescription: "Validate locations before buying vending machines.",
    suggestedSlug: "start-vending-business",
  },
  blocks: [
    {
      block: {
        id: "ai_intro",
        type: "rich_text",
        variant: "intro",
        props: {
          eyebrow: "Vending startup guide",
          heading: "Validate the location before buying machines",
          body: {
            version: 1,
            nodes: [
              {
                type: "paragraph",
                text: "Before buying machines, validate that the location has demand.",
              },
            ],
          },
        },
      },
      sourceDocumentIds: [documentId],
      sourceExcerptIds: [excerptId],
      approvedClaimIds: [claimId],
      warnings: [],
    },
  ],
  warnings: [],
};

function openAiResponse(output: unknown, init: ResponseInit = {}) {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text:
                typeof output === "string" ? output : JSON.stringify(output),
            },
          ],
        },
      ],
    }),
    { status: 200, ...init },
  );
}

describe("OpenAI SEO agent", () => {
  it("calls the Responses API with structured output and source-bound input", async () => {
    const fetchFn = vi.fn().mockResolvedValue(openAiResponse(proposal));

    const result = await generateOpenAiSeoProposalFromSources(
      {
        page,
        sourceBundle,
        model: "gpt-5.5",
        reasoningEffort: "medium",
        promptVersion: "test-prompt",
      },
      { apiKey: "sk-test", fetchFn },
    );

    expect(result).toEqual(proposal);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual(
      expect.objectContaining({
        model: "gpt-5.5",
        reasoning: { effort: "medium" },
        store: false,
        max_output_tokens: 6000,
      }),
    );
    expect(body.text.format).toEqual(
      expect.objectContaining({
        type: "json_schema",
        name: "seo_page_proposal",
        strict: true,
      }),
    );
    expect(body.input).toContain(excerptId);
    expect(body.input).toContain(claimId);
    expect(body.input).not.toContain("sk-test");
  });

  it("fails before calling OpenAI when the key is missing", async () => {
    const fetchFn = vi.fn();

    await expect(
      generateOpenAiSeoProposalFromSources(
        { page, sourceBundle, model: "gpt-5.5" },
        { apiKey: "", fetchFn },
      ),
    ).rejects.toBeInstanceOf(SeoAgentConfigurationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("surfaces OpenAI API rejection codes without leaking secrets", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "insufficient_quota",
            message: "Quota exceeded.",
          },
        }),
        { status: 429 },
      ),
    );

    await expect(
      generateOpenAiSeoProposalFromSources(
        { page, sourceBundle, model: "gpt-5.5" },
        { apiKey: "sk-test", fetchFn },
      ),
    ).rejects.toMatchObject({
      name: "SeoAgentGenerationError",
      status: 429,
      code: "insufficient_quota",
    });
  });

  it("rejects proposal source IDs that were not selected", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      openAiResponse({
        ...proposal,
        blocks: [
          {
            ...proposal.blocks[0],
            sourceExcerptIds: ["55555555-5555-4555-8555-555555555555"],
          },
        ],
      }),
    );

    await expect(
      generateOpenAiSeoProposalFromSources(
        { page, sourceBundle, model: "gpt-5.5" },
        { apiKey: "sk-test", fetchFn },
      ),
    ).rejects.toBeInstanceOf(SeoAgentGenerationError);
  });
});
