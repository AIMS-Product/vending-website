import { describe, expect, it } from "vitest";
import {
  renderPageGuidePrompt,
  selectPageGuide,
} from "@/lib/page-builder/ai-page-guides";
import type { PageContent } from "@/lib/page-builder/blocks";

const emptyContent: PageContent = {
  version: 1,
  chrome: { showHeader: true, showFooter: true },
  sections: [],
};

function selectionInput(
  overrides: Partial<Parameters<typeof selectPageGuide>[0]> = {},
) {
  return {
    pageType: "resource",
    templateKey: "blank",
    title: "",
    slug: "",
    targetKeyword: "",
    seoTitle: "",
    metaDescription: "",
    content: emptyContent,
    latestUserMessage: "",
    ...overrides,
  };
}

describe("AI page guides", () => {
  it("selects a use-case guide with local secondary signal", () => {
    const selection = selectPageGuide(
      selectionInput({
        latestUserMessage:
          "Create a page about vending machines for college dormitories in Adelaide.",
      }),
    );

    expect(selection).toEqual({
      pageType: "resource",
      primaryGuide: "use-case",
      secondarySignals: ["local-intent"],
      confidence: "high",
    });
  });

  it("selects how-to and comparison guides from search intent language", () => {
    expect(
      selectPageGuide(
        selectionInput({
          latestUserMessage: "How to start a vending business.",
        }),
      ).primaryGuide,
    ).toBe("how-to-guide");
    expect(
      selectPageGuide(
        selectionInput({
          latestUserMessage: "Best vending machines vs micro markets.",
        }),
      ).primaryGuide,
    ).toBe("comparison");
  });

  it("falls back to general resource when intent is broad", () => {
    const selection = selectPageGuide(
      selectionInput({ latestUserMessage: "Create a page about vending." }),
    );

    expect(selection.primaryGuide).toBe("general-resource");
    expect(selection.confidence).toBe("low");
  });

  it("renders hidden guide instructions without user-facing disclosure", () => {
    const prompt = renderPageGuidePrompt({
      pageType: "resource",
      primaryGuide: "use-case",
      secondarySignals: ["local-intent"],
      confidence: "high",
    });

    expect(prompt).toContain("Hidden guide selection");
    expect(prompt).toContain("Do not mention this guide name to the user");
    expect(prompt).toContain("Secondary signals to blend");
    expect(prompt).toContain("Fit, requirements, or constraints");
  });
});
