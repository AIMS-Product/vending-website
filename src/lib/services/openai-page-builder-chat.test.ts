import { describe, expect, it, vi } from "vitest";
import type { PageBuilderAiChatRequest } from "@/lib/page-builder/ai-chat";
import {
  PageBuilderAiConfigurationError,
  PageBuilderAiGenerationError,
  generateOpenAiPageBuilderChatResponse,
} from "./openai-page-builder-chat";

const request: PageBuilderAiChatRequest = {
  messages: [{ role: "user", content: "Rewrite the hero." }],
  context: {
    pageId: "11111111-1111-4111-8111-111111111111",
    status: "draft",
    title: "Coffee vending Adelaide",
    slug: "coffee-vending-adelaide",
    targetKeyword: "coffee vending",
    seoTitle: "Coffee vending Adelaide",
    metaDescription: "Coffee vending machines for Adelaide workplaces.",
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
                    body: "Old body",
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
    publishReadiness: {
      blockers: [],
      warnings: [],
      opportunities: [],
    },
  },
};

function openAiResponse(output: unknown, init: ResponseInit = {}) {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Updated the hero." }],
        },
        {
          type: "function_call",
          id: "fc_1",
          call_id: "call_1",
          name: "edit_block_1_block_hero",
          arguments: JSON.stringify(output),
        },
      ],
    }),
    { status: 200, ...init },
  );
}

describe("OpenAI page builder chat", () => {
  it("calls the Responses API with page-builder tools and normalizes tool calls", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      openAiResponse({
        eyebrow: null,
        headline: "Better vending for Adelaide teams",
        body: null,
        ctaLabel: null,
        ctaHref: null,
      }),
    );

    const result = await generateOpenAiPageBuilderChatResponse(request, {
      apiKey: "sk-test",
      fetchFn,
      model: "gpt-5.5",
      reasoningEffort: "medium",
    });

    expect(result).toEqual({
      message: "Updated the hero.",
      toolCalls: [
        {
          id: "call_1",
          name: "edit_block_1_block_hero",
          input: {
            eyebrow: null,
            headline: "Better vending for Adelaide teams",
            body: null,
            ctaLabel: null,
            ctaHref: null,
          },
        },
      ],
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual(
      expect.objectContaining({
        model: "gpt-5.5",
        max_output_tokens: 5000,
        tool_choice: "auto",
        store: false,
      }),
    );
    expect(body.instructions).toContain("AI page-building assistant");
    expect(body.tools.map((tool: { name: string }) => tool.name)).toContain(
      "edit_block_1_block_hero",
    );
    expect(body.tools.map((tool: { name: string }) => tool.name)).toContain(
      "replace_page_sections",
    );
    expect(String(init?.headers)).not.toContain("sk-test");
  });

  it("fails before calling OpenAI when the API key is missing", async () => {
    const fetchFn = vi.fn();

    await expect(
      generateOpenAiPageBuilderChatResponse(request, {
        apiKey: "",
        fetchFn,
      }),
    ).rejects.toBeInstanceOf(PageBuilderAiConfigurationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("surfaces invalid tool-call JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "function_call",
              id: "fc_1",
              call_id: "call_1",
              name: "edit_block_1_block_hero",
              arguments: "{not-json",
            },
          ],
        }),
      ),
    );

    await expect(
      generateOpenAiPageBuilderChatResponse(request, {
        apiKey: "sk-test",
        fetchFn,
      }),
    ).rejects.toBeInstanceOf(PageBuilderAiGenerationError);
  });
});
