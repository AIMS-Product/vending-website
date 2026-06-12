import { describe, expect, it, vi } from "vitest";
import type {
  PageBuilderAiChatRequest,
  PageBuilderAiChatResponse,
} from "./ai-chat";
import {
  buildCopyRepairRequest,
  collectDraftCopyIssues,
  generateWithCopyRepair,
} from "./ai-chat-copy-repair";

const request: PageBuilderAiChatRequest = {
  messages: [{ role: "user", content: "Rewrite the hero." }],
  context: {
    pageId: "11111111-1111-4111-8111-111111111111",
    status: "draft",
    title: "Coffee vending for offices",
    slug: "coffee-vending-offices",
    pageType: "resource",
    templateKey: "blank",
    targetKeyword: "coffee vending machines for offices",
    seoTitle: "",
    metaDescription: "",
    selectedBlockId: null,
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
                    body: "Coffee vending machines for offices keep teams stocked with fresh drinks without anyone owning a brewing rota. A managed machine covers restocking, cleaning, and fault response for the site.",
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
  },
};

const heroEdit = (body: string): PageBuilderAiChatResponse => ({
  message: "Updated the hero.",
  toolCalls: [
    {
      id: "call_1",
      name: "edit_block_1_block_hero",
      input: {
        eyebrow: null,
        headline: null,
        body,
        ctaLabel: null,
        ctaHref: null,
      },
    },
  ],
});

const thinResponse = heroEdit("Quick coffee for busy teams.");
const goodResponse = heroEdit(
  "Hand the whole coffee routine to a managed machine that covers restocking, cleaning, and fault response. Most offices are pouring drinks within two weeks of a site walk-through, so book the assessment now.",
);

describe("collectDraftCopyIssues", () => {
  it("returns gate failures for thin edited copy", () => {
    const issues = collectDraftCopyIssues(request, thinResponse);
    expect(issues.some((issue) => issue.includes("Hero body has"))).toBe(true);
  });

  it("returns nothing for copy that passes the gate", () => {
    expect(collectDraftCopyIssues(request, goodResponse)).toEqual([]);
  });

  it("returns nothing when no content tools were called", () => {
    expect(
      collectDraftCopyIssues(request, { message: "Hi.", toolCalls: [] }),
    ).toEqual([]);
  });

  it("adds complete-draft tier issues for replace_page_sections drafts", () => {
    const issues = collectDraftCopyIssues(request, {
      message: "Drafted.",
      toolCalls: [
        {
          id: "call_1",
          name: "replace_page_sections",
          input: {
            replaceExisting: true,
            sections: [
              {
                title: "Hero",
                blocks: [
                  {
                    blockType: "hero",
                    title: "Coffee vending machines for offices",
                    body: "Short hero body for the office vending page today.",
                    bulletItems: null,
                    faqItems: null,
                    cards: null,
                    ctaLabel: "Contact",
                    ctaHref: "/contact",
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(issues.some((issue) => issue.includes("at least 5 blocks"))).toBe(
      true,
    );
    expect(issues.some((issue) => issue.includes("FAQ"))).toBe(true);
  });
});

describe("buildCopyRepairRequest", () => {
  it("appends the draft and the issues to the conversation", () => {
    const issues = collectDraftCopyIssues(request, thinResponse);
    const repair = buildCopyRepairRequest(request, thinResponse, issues);

    expect(repair.messages).toHaveLength(request.messages.length + 2);
    expect(repair.messages.at(-2)).toMatchObject({ role: "assistant" });
    expect(repair.messages.at(-2)?.content).toContain(
      "edit_block_1_block_hero",
    );
    expect(repair.messages.at(-1)?.content).toContain(
      "copy-quality gate rejected",
    );
    expect(repair.messages.at(-1)?.content).toContain("Hero body has");
    expect(repair.context).toBe(request.context);
  });
});

describe("generateWithCopyRepair", () => {
  it("repairs a failing response and reports it", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(thinResponse)
      .mockResolvedValueOnce(goodResponse);

    const result = await generateWithCopyRepair(request, generate);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.repaired).toBe(true);
    expect(result.response).toBe(goodResponse);
  });

  it("does not call generate again when the first response passes", async () => {
    const generate = vi.fn().mockResolvedValue(goodResponse);

    const result = await generateWithCopyRepair(request, generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.repaired).toBe(false);
  });

  it("keeps the original when the retry loses the edit or fails", async () => {
    const droppedEdit = vi
      .fn()
      .mockResolvedValueOnce(thinResponse)
      .mockResolvedValueOnce({ message: "Sorry.", toolCalls: [] });
    const dropped = await generateWithCopyRepair(request, droppedEdit);
    expect(dropped.response).toBe(thinResponse);
    expect(dropped.repaired).toBe(false);

    const erroring = vi
      .fn()
      .mockResolvedValueOnce(thinResponse)
      .mockRejectedValueOnce(new Error("provider down"));
    const kept = await generateWithCopyRepair(request, erroring);
    expect(kept.response).toBe(thinResponse);
    expect(kept.repaired).toBe(false);
  });
});
