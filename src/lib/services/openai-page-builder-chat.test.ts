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
    pageType: "resource",
    templateKey: "blank",
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
                    // Long enough to pass the copy-quality gate so tests that
                    // edit other fields do not trigger the repair round-trip.
                    body: "Coffee vending keeps Adelaide teams stocked with fresh drinks without anyone owning a brewing rota. A managed machine covers restocking, cleaning, and fault response so facilities can stay focused on the building.",
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

function openAiMessageOnlyResponse(message: string, init: ResponseInit = {}) {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: message }],
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
        max_output_tokens: 8000,
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
    expect(body.tools.map((tool: { name: string }) => tool.name)).toContain(
      "add_image_text_section",
    );
    expect(body.tools.map((tool: { name: string }) => tool.name)).toContain(
      "add_media_block",
    );
    expect(String(init?.headers)).not.toContain("sk-test");
  });

  it("turns vague human image-and-text section asks into a clarification", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        openAiMessageOnlyResponse("I can add the text and note the image."),
      );

    const result = await generateOpenAiPageBuilderChatResponse(
      {
        ...request,
        messages: [
          {
            role: "user",
            content: "Add an image section with text about campus vending.",
          },
        ],
      },
      {
        apiKey: "sk-test",
        fetchFn,
      },
    );

    expect(result).toEqual({
      message:
        "I can add the image and text section, but I need the image source first.",
      source: "intent-fallback",
      toolCalls: [
        {
          id: "deterministic_image_text_clarification",
          name: "request_clarification",
          input: {
            options: [
              "Paste an image URL",
              "Choose a media library image first",
              "Add the text section now",
            ],
          },
        },
      ],
    });
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

  it("repairs a draft that fails the copy-quality gate", async () => {
    const thinBody = "Quick coffee for teams.";
    const goodBody =
      "Hand the whole coffee routine to a managed machine that covers restocking, cleaning, and fault response. Most offices are pouring drinks within two weeks of a site walk-through, so book the assessment now.";
    const heroEdit = (body: string) =>
      openAiResponse({
        eyebrow: null,
        headline: null,
        body,
        ctaLabel: null,
        ctaHref: null,
      });
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(heroEdit(thinBody))
      .mockResolvedValueOnce(heroEdit(goodBody));

    const result = await generateOpenAiPageBuilderChatResponse(request, {
      apiKey: "sk-test",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [, repairInit] = fetchFn.mock.calls[1]!;
    const repairBody = JSON.parse(String(repairInit?.body));
    const repairMessages = JSON.stringify(repairBody.input);
    expect(repairMessages).toContain("copy-quality gate rejected");
    expect(repairMessages).toContain("Hero body has");
    expect(result.toolCalls[0]?.input).toMatchObject({ body: goodBody });
  });

  it("keeps the original response when the repair attempt does not improve", async () => {
    const fetchFn = vi.fn().mockImplementation(async () =>
      openAiResponse({
        eyebrow: null,
        headline: "Better vending",
        body: "Quick coffee for teams.",
        ctaLabel: null,
        ctaHref: null,
      }),
    );

    const result = await generateOpenAiPageBuilderChatResponse(request, {
      apiKey: "sk-test",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.toolCalls[0]?.input).toMatchObject({
      headline: "Better vending",
    });
  });

  it("keeps valid tool calls when the assistant message exceeds the transport cap", async () => {
    const longMessage = "Detailed summary of the rebuilt page. ".repeat(220);
    expect(longMessage.length).toBeGreaterThan(6000);
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: longMessage }],
            },
            {
              type: "function_call",
              id: "fc_1",
              call_id: "call_1",
              name: "edit_block_1_block_hero",
              arguments: JSON.stringify({
                eyebrow: null,
                headline: "Better vending for Adelaide teams",
                body: null,
                ctaLabel: null,
                ctaHref: null,
              }),
            },
          ],
        }),
      ),
    );

    const result = await generateOpenAiPageBuilderChatResponse(request, {
      apiKey: "sk-test",
      fetchFn,
    });

    expect(result.message.length).toBeLessThanOrEqual(6000);
    expect(result.toolCalls).toEqual([
      expect.objectContaining({ name: "edit_block_1_block_hero" }),
    ]);
  });
});
