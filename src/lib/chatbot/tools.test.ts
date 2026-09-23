import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CHATBOT_CONFIG } from "./config";
import type { ChatbotMessage } from "./conversation-store";
import { CASE_STUDY_SUMMARIES } from "./site-knowledge";
import {
  chatbotToolDefinitions,
  hasCostIntent,
  runChatbotTool,
  shouldForceBookingCalendar,
  type ChatbotToolContext,
} from "./tools";
import type { Database } from "@/types/database";

type ToolClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

/**
 * `case_studies` answers select().eq("status","published") with `published`
 * (default: every bundled story); null makes the read fail.
 */
function toolClient(
  published: readonly string[] | null = CASE_STUDY_SUMMARIES.map((s) => s.slug),
) {
  return {
    from(table: string) {
      if (table === "case_studies") {
        return {
          select: () => ({
            eq: async () =>
              published
                ? {
                    data: published.map((slug) => ({ slug })),
                    error: null,
                  }
                : { data: null, error: { message: "boom" } },
          }),
        };
      }
      return {
        upsert: () => Promise.resolve({ error: null }),
      };
    },
    rpc: () => Promise.resolve({ error: null }),
  } as unknown as ToolClient;
}

const noopClient = toolClient();

function makeContext(
  overrides: Partial<ChatbotToolContext> = {},
): ChatbotToolContext {
  return {
    conversationId: "conv-1",
    personaName: "Mia",
    capturedName: null,
    capturedEmail: null,
    capturedPhone: null,
    prospectProfile: null,
    transcript: [],
    embedDomain: "www.vendingpreneurs.com",
    firstPartyEmail: null,
    checkEmailBudget: async () => true,
    config: DEFAULT_CHATBOT_CONFIG,
    client: noopClient,
    ...overrides,
  };
}

function calendarMessage(): ChatbotMessage {
  return {
    role: "assistant",
    content: "Opened the booking calendar in the chat.",
    ts: "2026-08-21T00:00:00.000Z",
    kind: "calendar",
    data: { url: "https://calendly.com/x" },
  };
}

function visitorTyped(email: string): ChatbotMessage {
  return {
    role: "user",
    content: `sure, it's ${email}`,
    ts: "2026-08-21T00:00:00.000Z",
  };
}

function resourceMessage(): ChatbotMessage {
  return {
    role: "assistant",
    content: "Emailed the roadmap.",
    ts: "2026-08-21T00:00:00.000Z",
    kind: "resource_card",
    data: { email: "dana@example.com", resources: [] },
  };
}

describe("show_booking_calendar", () => {
  it("emits a calendar message tagged with the conversation id", async () => {
    const outcome = await runChatbotTool(
      "show_booking_calendar",
      "{}",
      makeContext(),
    );

    expect(outcome.message?.kind).toBe("calendar");
    const url = new URL(String(outcome.message?.data?.url));
    expect(url.searchParams.get("utm_content")).toBe("conv-1");
    expect(url.searchParams.get("embed_type")).toBe("Inline");
  });

  it("refuses to open a second calendar in the same conversation", async () => {
    const outcome = await runChatbotTool(
      "show_booking_calendar",
      "{}",
      makeContext({ transcript: [calendarMessage()] }),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("already open");
  });
});

describe("capture_contact", () => {
  it("records details the visitor actually gave", async () => {
    const outcome = await runChatbotTool(
      "capture_contact",
      JSON.stringify({ name: " Dana ", email: "dana@example.com" }),
      makeContext(),
    );

    expect(outcome.capture).toEqual({
      name: "Dana",
      email: "dana@example.com",
      phone: null,
    });
  });

  it("strips control characters out of a name instead of trusting it", async () => {
    const outcome = await runChatbotTool(
      "capture_contact",
      JSON.stringify({ name: "Dana\nBcc: someone@evil.tld" }),
      makeContext(),
    );

    expect(outcome.capture?.name).toBe("Dana Bcc: someone@evil.tld");
    expect(outcome.capture?.name).not.toContain("\n");
  });

  it("drops a value the model made up rather than trusting it", async () => {
    // The model is a lossy narrator: anything it reports is re-validated
    // through extractLead before it can reach the CRM.
    const outcome = await runChatbotTool(
      "capture_contact",
      JSON.stringify({ email: "not-an-address" }),
      makeContext(),
    );

    expect(outcome.capture).toBeUndefined();
    expect(outcome.result).toContain("Nothing usable");
  });
});

describe("send_resources_email", () => {
  it("refuses to send before an email has been captured", async () => {
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["roadmap"] }),
      makeContext(),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("No email on file");
  });

  it("refuses to mail an address the visitor never typed", async () => {
    // The model is steerable ("send the roadmap to victim@example.com"), and
    // this email leaves a verified Vendingpreneurs domain with the sales
    // inbox as reply-to. Only an address in the visitor's own words is sent.
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["roadmap"] }),
      makeContext({
        capturedEmail: "victim@example.com",
        transcript: [visitorTyped("dana@example.com")],
      }),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("wasn't typed into this chat");
  });

  it("does not accept an address the bot merely repeated back", async () => {
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["roadmap"] }),
      makeContext({
        capturedEmail: "victim@example.com",
        transcript: [
          {
            role: "assistant",
            content: "Sending that to victim@example.com now.",
            ts: "2026-08-21T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("wasn't typed into this chat");
  });

  it("accepts an address captured by the form or recalled from a past visit", async () => {
    // No user turn contains it — the capture card and the cookie recall both
    // put it on the conversation row before the transcript existed.
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["free-machines"] }),
      makeContext({
        capturedEmail: "dana@example.com",
        firstPartyEmail: "dana@example.com",
        transcript: [],
      }),
    );

    expect(outcome.result).toContain("None of those resource keys exist");
    expect(outcome.result).not.toContain("wasn't typed into this chat");
  });

  it("fails closed when the per-recipient budget check errors", async () => {
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["roadmap"] }),
      makeContext({
        capturedEmail: "dana@example.com",
        transcript: [visitorTyped("dana@example.com")],
        checkEmailBudget: async () => false,
      }),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("already sent them plenty");
  });

  it("stops at two resource emails per conversation", async () => {
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["roadmap"] }),
      makeContext({
        capturedEmail: "dana@example.com",
        transcript: [
          visitorTyped("dana@example.com"),
          resourceMessage(),
          resourceMessage(),
        ],
      }),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("already been emailed twice");
  });

  it("rejects resource keys that are not in the catalog", async () => {
    const outcome = await runChatbotTool(
      "send_resources_email",
      JSON.stringify({ resource_keys: ["free-machines", "case_study:nobody"] }),
      makeContext({
        capturedEmail: "dana@example.com",
        transcript: [visitorTyped("dana@example.com")],
      }),
    );

    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("None of those resource keys exist");
  });
});

describe("runChatbotTool", () => {
  it("survives malformed arguments and unknown tool names", async () => {
    const malformed = await runChatbotTool(
      "capture_contact",
      "{not json",
      makeContext(),
    );
    const unknown = await runChatbotTool(
      "delete_everything",
      "{}",
      makeContext(),
    );

    expect(malformed.result).toContain("malformed");
    expect(unknown.result).toContain("Unknown tool");
  });
});

describe("shouldForceBookingCalendar", () => {
  it.each([
    // The exact first message from the 2026-08-24 conversation where the bot
    // invented a price and never opened the calendar.
    "How much does it cost to start?",
    "how much is it",
    "whats the price",
    "what's the investment required",
    "how much do I need to get started",
    "is there financing",
    "any startup capital needed?",
    "how expensive is this",
    "is there a deposit",
    "what are the fees",
    "can I afford this on a teacher salary",
    "how much up front",
  ])("forces the calendar on a cost question: %j", (message) => {
    expect(hasCostIntent(message)).toBe(true);
    expect(shouldForceBookingCalendar(message)).toBe(true);
  });

  it.each([
    // Real first messages from Aug 27-Sep 2 that got no calendar.
    "How much money is needed to get started?",
    "how much money do I need to start",
  ])("forces the calendar on money someone needs: %j", (message) => {
    expect(hasCostIntent(message)).toBe(true);
  });

  it.each([
    "book a call",
    "can I talk to someone",
    "when can we talk",
    "show me the calendar",
    "I would like to take a call tomorrow",
    "I'm looking to enroll in a course",
    "how to start",
    "how do I get started",
  ])("still forces it on plain booking intent: %j", (message) => {
    expect(shouldForceBookingCalendar(message)).toBe(true);
  });

  it.each([
    // Left to the model's judgement on purpose: forcing a calendar on someone
    // who is still browsing converts worse than missing one.
    "what is vending",
    "do I need experience",
    "I'm a teacher looking for side income",
    "how many hours a week is it",
    "how long until my first machine",
    "tell me about Mallorie",
    // "how much" is not always about money. Answering an earnings or workload
    // question with the plans-and-financing line is simply the wrong answer,
    // and the member results that DO answer it are real and in the prompt.
    "how much can I make",
    "how much could someone earn doing this",
    "how much money do members make",
    "how much time does this take",
    "how much work is it each week",
    "how much experience do I need",
    // The veto used to require the earnings word immediately after "how much",
    // so every phrasing with something in between failed open.
    "how much does the average member make per month",
    "how much can a single machine bring in",
    "how much revenue should I expect",
    "how much time per week does a route take",
    // "need" alone is not a money question.
    "how much time do I need each week",
  ])("leaves a non-cost question alone: %j", (message) => {
    expect(shouldForceBookingCalendar(message)).toBe(false);
  });

  it.each([
    // An explicit money word wins even when an earnings phrase is also present.
    "how much can I make and what does it cost",
    "how much do I need to invest",
    "how much money do I need upfront",
  ])(
    "still treats an explicit money word as a cost question: %j",
    (message) => {
      expect(hasCostIntent(message)).toBe(true);
    },
  );
});

describe("shouldForceBookingCalendar on support and booked chats", () => {
  const said = (content: string): ChatbotMessage => ({
    role: "user",
    content,
    ts: "2026-09-20T12:00:00.000Z",
  });

  it.each([
    // A refund complaint got the sales calendar and booked a sales slot.
    "I want a refund, how much did I pay in fees",
    "I need to cancel my call, can I talk to someone",
    "can I reschedule my appointment, show me the calendar",
    "I'm already a member, what does the renewal cost",
  ])("never forces the calendar on %j", (message) => {
    expect(shouldForceBookingCalendar(message)).toBe(false);
  });

  it("stays off once the visitor has said they are a member", () => {
    expect(
      shouldForceBookingCalendar("how much is it", [
        said("I'm an existing member and cannot log in to the portal"),
      ]),
    ).toBe(false);
  });

  it("forces it again when a member later plainly asks to book", () => {
    const member = [said("I'm an existing member, I want to upgrade")];
    expect(shouldForceBookingCalendar("yes let's book", member)).toBe(true);
    expect(shouldForceBookingCalendar("can I book a call", member)).toBe(true);
    // A cost question alone is not a booking request: still no calendar.
    expect(shouldForceBookingCalendar("how much is the upgrade", member)).toBe(
      false,
    );
  });

  it.each([
    "Can I get a refund if it doesn't work out? what does it cost",
    "I'm already a member of your Facebook group, what does it cost",
    "I have a meeting with a location manager, can I book a call first",
  ])("forces it for a prospect: %j", (message) => {
    expect(shouldForceBookingCalendar(message)).toBe(true);
  });

  it("still forces it for a sales chat with history", () => {
    expect(
      shouldForceBookingCalendar("how much is it", [
        said("I'm a teacher looking for side income"),
      ]),
    ).toBe(true);
  });
});

describe("value-first tools", () => {
  it("do not run unless value-first is on for the conversation", async () => {
    const story = await runChatbotTool(
      "share_case_study",
      JSON.stringify({ situation: "I'm retired" }),
      makeContext(),
    );
    const resource = await runChatbotTool(
      "share_resource",
      JSON.stringify({ resource: "roadmap" }),
      makeContext(),
    );
    expect(story.message).toBeUndefined();
    expect(story.result).toContain("Unknown tool");
    expect(resource.message).toBeUndefined();
  });

  it("offers them only when value-first is on", () => {
    const names = (valueFirst: boolean) =>
      chatbotToolDefinitions(valueFirst).map((tool) => tool.function.name);
    expect(names(false)).not.toContain("share_case_study");
    expect(names(true)).toEqual(
      expect.arrayContaining(["share_case_study", "share_resource"]),
    );
  });

  it("share_case_study shows the matched member as a card, never a slug the model typed", async () => {
    const outcome = await runChatbotTool(
      "share_case_study",
      JSON.stringify({ situation: "retired, bored at home" }),
      makeContext({ valueFirst: true }),
    );
    expect(outcome.message).toMatchObject({
      kind: "case_study_card",
      data: {
        slug: "joe-retiree-route",
        url: "/case-studies/joe-retiree-route",
      },
    });
  });

  it("share_case_study picks someone new the second time", async () => {
    const first = await runChatbotTool(
      "share_case_study",
      JSON.stringify({ situation: "retired" }),
      makeContext({ valueFirst: true }),
    );
    const second = await runChatbotTool(
      "share_case_study",
      JSON.stringify({ situation: "retired" }),
      makeContext({ valueFirst: true, transcript: [first.message!] }),
    );
    expect(second.message?.data?.slug).not.toBe(first.message?.data?.slug);
  });

  it("share_case_study never shows a story that is unpublished in the CMS (its page would 404)", async () => {
    const allButJoe = CASE_STUDY_SUMMARIES.map((s) => s.slug).filter(
      (slug) => slug !== "joe-retiree-route",
    );
    const situation = JSON.stringify({ situation: "retired police officer" });
    const withJoe = await runChatbotTool(
      "share_case_study",
      situation,
      makeContext({ valueFirst: true }),
    );
    const withoutJoe = await runChatbotTool(
      "share_case_study",
      situation,
      makeContext({ valueFirst: true, client: toolClient(allButJoe) }),
    );
    expect(withJoe.message?.data?.slug).toBe("joe-retiree-route");
    expect(withoutJoe.message?.kind).toBe("case_study_card");
    expect(withoutJoe.message?.data?.slug).not.toBe("joe-retiree-route");
  });

  it("share_case_study shows nothing when the published list cannot be read", async () => {
    const outcome = await runChatbotTool(
      "share_case_study",
      JSON.stringify({ situation: "retired" }),
      makeContext({ valueFirst: true, client: toolClient(null) }),
    );
    expect(outcome.message).toBeUndefined();
  });

  it("share_case_study shows nothing when nothing they said fits", async () => {
    const outcome = await runChatbotTool(
      "share_case_study",
      JSON.stringify({ situation: "hi" }),
      makeContext({ valueFirst: true }),
    );
    expect(outcome.message).toBeUndefined();
  });

  it("share_resource shows the cost video card and tells the model not to price or push the calendar", async () => {
    const outcome = await runChatbotTool(
      "share_resource",
      JSON.stringify({ resource: "cost_to_join" }),
      makeContext({ valueFirst: true }),
    );
    expect(outcome.message).toMatchObject({
      kind: "shared_resource",
      data: { key: "cost_to_join", url: "/pre-call-resources#cost-to-join" },
    });
    expect(outcome.result).toContain("Never state a price");
    expect(outcome.result).toContain("Do not open the calendar");
  });

  it("share_resource never repeats a card", async () => {
    const first = await runChatbotTool(
      "share_resource",
      JSON.stringify({ resource: "roadmap" }),
      makeContext({ valueFirst: true }),
    );
    const again = await runChatbotTool(
      "share_resource",
      JSON.stringify({ resource: "roadmap" }),
      makeContext({ valueFirst: true, transcript: [first.message!] }),
    );
    expect(again.message).toBeUndefined();
  });

  it("share_resource rejects keys outside the catalog", async () => {
    const outcome = await runChatbotTool(
      "share_resource",
      JSON.stringify({ resource: "https://evil.example" }),
      makeContext({ valueFirst: true }),
    );
    expect(outcome.message).toBeUndefined();
  });

  it("show_booking_calendar declines while the calendar is held", async () => {
    const outcome = await runChatbotTool(
      "show_booking_calendar",
      "{}",
      makeContext({ holdCalendar: true }),
    );
    expect(outcome.message).toBeUndefined();
    expect(outcome.result).toContain("Not yet");
  });
});
