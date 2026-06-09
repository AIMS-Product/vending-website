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

function cerebrasToolResponse(output: unknown, init: ResponseInit = {}) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: "Updated the hero.",
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "edit_block_1_block_hero",
                  arguments: JSON.stringify(output),
                },
              },
            ],
          },
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
      provider: "openai",
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
        provider: "openai",
      },
    );

    expect(result).toEqual({
      message:
        "I can add the image and text section, but I need the image source first.",
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
        provider: "openai",
        apiKey: "",
        fetchFn,
      }),
    ).rejects.toBeInstanceOf(PageBuilderAiConfigurationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("calls Cerebras chat completions with page-builder tools", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      cerebrasToolResponse({
        eyebrow: null,
        headline: "Better vending for Adelaide teams",
        body: null,
        ctaLabel: null,
        ctaHref: null,
      }),
    );

    const result = await generateOpenAiPageBuilderChatResponse(request, {
      provider: "cerebras",
      cerebrasApiKey: "csk-test",
      fetchFn,
      model: "gpt-oss-120b",
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
    const [url, init] = fetchFn.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(String(url)).toBe("https://api.cerebras.ai/v1/chat/completions");
    expect(body).toEqual(
      expect.objectContaining({
        model: "gpt-oss-120b",
        reasoning_effort: "medium",
        max_completion_tokens: 5000,
        tool_choice: "auto",
      }),
    );
    expect(body.messages[0]).toEqual(
      expect.objectContaining({ role: "system" }),
    );
    expect(body.tools[0]).toEqual(
      expect.objectContaining({
        type: "function",
        function: expect.objectContaining({
          name: expect.any(String),
          strict: true,
        }),
      }),
    );
    expect(JSON.stringify(body)).not.toContain("csk-test");
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
        provider: "openai",
        apiKey: "sk-test",
        fetchFn,
      }),
    ).rejects.toBeInstanceOf(PageBuilderAiGenerationError);
  });
});
