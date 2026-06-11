import { describe, expect, it } from "vitest";
import { applyPageBuilderAiToolCalls } from "./ai-chat";
import { completePageDraftToolCall } from "./ai-chat-draft-copy";
import { selectPageGuide } from "./ai-page-guides";
import type { PageContent } from "./blocks";
import { assessSeoCopyQuality } from "./copy-quality";

const emptyContent: PageContent = { version: 1, sections: [] };
const TOPIC = "coffee vending machines for offices";

function fallbackDraftContent(latestUserMessage: string): PageContent {
  const pageGuide = selectPageGuide({
    pageType: "resource",
    templateKey: "blank",
    title: "",
    slug: "",
    targetKeyword: TOPIC,
    seoTitle: "",
    metaDescription: "",
    content: emptyContent,
    latestUserMessage,
  });
  const toolCall = completePageDraftToolCall(TOPIC, pageGuide, false);
  let counter = 0;
  return applyPageBuilderAiToolCalls({
    content: emptyContent,
    toolCalls: [toolCall],
    makeBlockId: () => `fallback_${(counter += 1)}`,
  }).content;
}

// The intent fallback replaces weak model drafts with this deterministic
// draft — so the deterministic draft itself must clear the copy-quality gate,
// or the fallback path ships exactly the thin copy the gate exists to stop.
describe("completePageDraftToolCall copy quality", () => {
  it("passes the copy-quality gate for a standard create-page draft", () => {
    const gate = assessSeoCopyQuality(
      fallbackDraftContent("Create a complete draft for this page"),
      { targetKeyword: TOPIC, scope: "page" },
    );
    expect(
      gate.findings.filter((finding) => finding.severity === "fail"),
    ).toEqual([]);
    expect(gate.verdict).toBe("pass");
  });

  it("passes the copy-quality gate for a how-to guide draft", () => {
    const gate = assessSeoCopyQuality(
      fallbackDraftContent("Write a how to guide about starting with vending"),
      { targetKeyword: TOPIC, scope: "page" },
    );
    expect(
      gate.findings.filter((finding) => finding.severity === "fail"),
    ).toEqual([]);
  });
});
