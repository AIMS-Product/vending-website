import { describe, expect, it } from "vitest";
import {
  buildEngagementSummary,
  type EngagementConversationRow,
} from "@/lib/chatbot/engagement-summary";

function conversation(
  overrides: Partial<EngagementConversationRow> = {},
): EngagementConversationRow {
  return {
    id: "conv-1",
    page_url: "https://www.vendingpreneurs.com/start",
    created_at: "2026-08-20T10:00:00.000Z",
    messages: [],
    prospect_profile: null,
    ...overrides,
  };
}

const text = (role: "user" | "assistant", content: string) => ({
  role,
  content,
  ts: "2026-08-20T10:00:00.000Z",
});

describe("buildEngagementSummary", () => {
  it("returns null with no conversations at all", () => {
    expect(buildEngagementSummary([])).toBeNull();
  });

  it("returns null when there is nothing worth telling a rep", () => {
    expect(
      buildEngagementSummary([conversation({ page_url: null })]),
    ).toBeNull();
  });

  it("keeps the entry page alone as enough context", () => {
    const summary = buildEngagementSummary([conversation()]);
    expect(summary?.entryPage).toBe("https://www.vendingpreneurs.com/start");
  });

  it("collects the visitor's own questions, in order and deduped", () => {
    const summary = buildEngagementSummary([
      conversation({
        messages: [
          text("user", "How do I find locations?"),
          text("assistant", "Great question."),
          text("user", "how do i find locations?"),
          text("user", "  What machines do you   recommend? "),
        ],
      }),
    ]);

    expect(summary?.questionsAsked).toEqual([
      "How do I find locations?",
      "What machines do you recommend?",
    ]);
  });

  it("ignores our own narration on rich messages", () => {
    const summary = buildEngagementSummary([
      conversation({
        messages: [
          text("user", "Can I book a call?"),
          {
            ...text("user", "Opened the booking calendar in the chat."),
            kind: "calendar",
          },
        ],
      }),
    ]);

    expect(summary?.questionsAsked).toEqual(["Can I book a call?"]);
  });

  it("reads case-study slugs out of the assistant's links", () => {
    const summary = buildEngagementSummary([
      conversation({
        messages: [
          text(
            "assistant",
            "Look at [Anthony](/case-studies/anthony-kolodziej) and also /case-studies/retired-teacher-route",
          ),
          text("assistant", "Again: /case-studies/anthony-kolodziej"),
        ],
      }),
    ]);

    expect(summary?.caseStudiesShown.map((study) => study.slug)).toEqual([
      "anthony-kolodziej",
      "retired-teacher-route",
    ]);
  });

  it("does not credit a case study the visitor pasted themselves", () => {
    const summary = buildEngagementSummary([
      conversation({
        messages: [text("user", "I read /case-studies/anthony-kolodziej")],
      }),
    ]);

    expect(summary?.caseStudiesShown).toEqual([]);
  });

  it("lists resources sent from the resource card payload", () => {
    const summary = buildEngagementSummary([
      conversation({
        messages: [
          {
            ...text("assistant", "Sent those over."),
            kind: "resource_card",
            data: {
              resources: [
                { title: "The 90-Day Roadmap", url: "/roadmap" },
                { title: "Finance Templates", url: "/finance" },
              ],
            },
          },
        ],
      }),
    ]);

    expect(summary?.resourcesSent).toEqual([
      "The 90-Day Roadmap",
      "Finance Templates",
    ]);
  });

  it("aggregates sessions oldest-first and keeps the first entry page", () => {
    const summary = buildEngagementSummary([
      conversation({
        id: "newer",
        created_at: "2026-08-22T10:00:00.000Z",
        page_url: "https://www.vendingpreneurs.com/pricing",
        messages: [text("user", "Second visit question")],
      }),
      conversation({
        id: "older",
        created_at: "2026-08-20T10:00:00.000Z",
        page_url: "https://www.vendingpreneurs.com/start",
        messages: [text("user", "First visit question")],
      }),
    ]);

    expect(summary?.conversationId).toBe("newer");
    expect(summary?.conversationCount).toBe(2);
    expect(summary?.entryPage).toBe("https://www.vendingpreneurs.com/start");
    expect(summary?.firstChattedAt).toBe("2026-08-20T10:00:00.000Z");
    expect(summary?.questionsAsked).toEqual([
      "First visit question",
      "Second visit question",
    ]);
  });

  it("does not let a later empty profile blank out what we already learned", () => {
    const summary = buildEngagementSummary([
      conversation({
        id: "older",
        created_at: "2026-08-20T10:00:00.000Z",
        prospect_profile: {
          name: null,
          email: null,
          phone: null,
          current_work: "Firefighter",
          capital_signal: null,
          timeline: null,
          state_or_market: null,
          motivation: "Wants weekends back",
          objections: [],
          resources_wanted: [],
          call_intent: false,
          sentiment: null,
          follow_up_needed: false,
          summary: null,
        },
      }),
      conversation({
        id: "newer",
        created_at: "2026-08-22T10:00:00.000Z",
        prospect_profile: {
          name: null,
          email: null,
          phone: null,
          current_work: null,
          capital_signal: "Has 20k saved",
          timeline: null,
          state_or_market: null,
          motivation: null,
          objections: [],
          resources_wanted: [],
          call_intent: false,
          sentiment: null,
          follow_up_needed: false,
          summary: null,
        },
      }),
    ]);

    expect(summary?.currentWork).toBe("Firefighter");
    expect(summary?.motivation).toBe("Wants weekends back");
    expect(summary?.capitalSignal).toBe("Has 20k saved");
  });

  it("survives junk in the messages jsonb without throwing", () => {
    const summary = buildEngagementSummary([
      conversation({
        messages: [
          null,
          "a bare string",
          { role: "user" },
          { role: "nobody", content: "x" },
          text("user", "Real question"),
        ],
      }),
    ]);

    expect(summary?.questionsAsked).toEqual(["Real question"]);
  });

  it("survives a messages value that is not an array", () => {
    const summary = buildEngagementSummary([
      conversation({ messages: { not: "an array" } }),
    ]);

    expect(summary?.questionsAsked).toEqual([]);
  });

  it("caps the number of questions so a note stays a briefing", () => {
    const summary = buildEngagementSummary([
      conversation({
        messages: Array.from({ length: 30 }, (_, index) =>
          text("user", `Question number ${index}`),
        ),
      }),
    ]);

    expect(summary?.questionsAsked).toHaveLength(8);
  });

  it("truncates a single enormous message rather than pasting an essay", () => {
    const summary = buildEngagementSummary([
      conversation({ messages: [text("user", "x".repeat(1000))] }),
    ]);

    expect(summary?.questionsAsked[0]).toHaveLength(240);
    expect(summary?.questionsAsked[0].endsWith("...")).toBe(true);
  });
});
