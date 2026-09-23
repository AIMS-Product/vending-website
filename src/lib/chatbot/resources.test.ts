import { describe, expect, it } from "vitest";
import { resolveChatbotResources, sharedResourceMessage } from "./resources";

describe("chatbot resource catalog", () => {
  it("links the roadmap and finance sheet to their delivered pages, not the gated forms", () => {
    const [roadmap, finance] = resolveChatbotResources([
      "roadmap",
      "finance_templates",
    ]);
    expect(roadmap?.url).toBe("/resources/roadmap-thank-you");
    expect(finance?.url).toBe("/resources/finance-templates-thank-you");
  });
});

describe("sharedResourceMessage", () => {
  const now = new Date("2026-09-23T12:00:00Z");

  it("builds an in-chat card that is not counted as an email", () => {
    const message = sharedResourceMessage(
      "roadmap",
      { label: "Free 90-day roadmap", via: "quick_action" },
      now,
    );
    expect(message).toMatchObject({
      role: "assistant",
      kind: "shared_resource",
      ts: now.toISOString(),
      data: {
        label: "Free 90-day roadmap",
        via: "quick_action",
        key: "roadmap",
        url: "/resources/roadmap-thank-you",
      },
    });
    expect(message?.kind).not.toBe("resource_card");
    expect(message?.content).toContain("in the chat");
  });

  it("returns null for a key outside the catalog", () => {
    expect(
      sharedResourceMessage(
        "nope" as "roadmap",
        { label: "x", via: "quick_action" },
        now,
      ),
    ).toBeNull();
  });
});
