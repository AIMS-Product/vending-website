import { describe, expect, it } from "vitest";
import {
  PRE_CALL_VIDEO_KEY_LIST,
  PRE_CALL_VIDEOS,
  resolveChatbotResources,
  sharedResourceMessage,
} from "./resources";

describe("chatbot resource catalog", () => {
  // Emailed links go only to an address the visitor gave, so they open the
  // delivered page, marked ?via=chat so GA4 never counts them as a form
  // conversion (ga4/client.ts excludes the marker).
  it("emails the delivered pages, marked as chat links", () => {
    const [roadmap, finance] = resolveChatbotResources([
      "roadmap",
      "finance_templates",
    ]);
    expect(roadmap?.url).toBe("/resources/roadmap-thank-you?via=chat");
    expect(finance?.url).toBe(
      "/resources/finance-templates-thank-you?via=chat",
    );
  });
});

describe("sharedResourceMessage", () => {
  const now = new Date("2026-09-23T12:00:00Z");

  it("builds an in-chat card that is not counted as an email", () => {
    const message = sharedResourceMessage(
      "roadmap",
      {
        label: "Free 90-day roadmap",
        via: "quick_action",
        emailCaptured: false,
      },
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
      },
    });
    expect(message?.kind).not.toBe("resource_card");
    expect(message?.content).toContain("in the chat");
  });

  it("keeps the roadmap gated until the chat has their email", () => {
    const gated = sharedResourceMessage("roadmap", {
      label: "x",
      via: "quick_action",
      emailCaptured: false,
    });
    const delivered = sharedResourceMessage("roadmap", {
      label: "x",
      via: "quick_action",
      emailCaptured: true,
    });
    expect(gated?.data?.url).toBe("/resources/roadmap");
    expect(delivered?.data?.url).toBe("/resources/roadmap-thank-you?via=chat");
  });

  it("shares a pre-call video by key, linking to it on the page", () => {
    const message = sharedResourceMessage(
      "cost_to_join",
      { label: "Video answer", via: "model", emailCaptured: false },
      now,
    );
    expect(message?.data).toMatchObject({
      key: "cost_to_join",
      title: "What Does It Actually Cost to Join Vendingpreneurs?",
      url: "/pre-call-resources#cost-to-join",
      via: "model",
    });
  });

  it("has every pre-call video key", () => {
    expect(PRE_CALL_VIDEOS.map((v) => v.key).sort()).toEqual(
      [...PRE_CALL_VIDEO_KEY_LIST].sort(),
    );
  });

  it("returns null for a key outside the catalog", () => {
    expect(
      sharedResourceMessage(
        "nope" as "roadmap",
        { label: "x", via: "quick_action", emailCaptured: false },
        now,
      ),
    ).toBeNull();
  });
});
