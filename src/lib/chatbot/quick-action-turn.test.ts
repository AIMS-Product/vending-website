import { describe, expect, it, vi } from "vitest";
import type { ChatbotMessage } from "./conversation-store";
import { quickActionTurn } from "./quick-action-turn";

const conversation = {
  id: "conv-1",
  captured_name: "Dana",
  captured_email: null,
};

const calendarMessage: ChatbotMessage = {
  role: "assistant",
  content: "Opened the booking calendar in the chat.",
  ts: "2026-09-23T12:00:00.000Z",
  kind: "calendar",
  data: {
    url: "https://calendly.com/x?utm_content=conv-1",
    via: "quick_action",
  },
};

function deps() {
  return {
    openCalendar: vi.fn(async () => ({ message: calendarMessage })),
  };
}

describe("quickActionTurn", () => {
  it("opens the tagged in-chat calendar for Book a call", async () => {
    const d = deps();
    const result = await quickActionTurn(
      {
        behavior: { type: "calendar" },
        label: "Book a call",
        conversation,
        transcript: [],
        embedDomain: "www.vendingpreneurs.com",
        timeZone: "America/Chicago",
      },
      d,
    );
    expect(d.openCalendar).toHaveBeenCalledWith({
      conversationId: "conv-1",
      capturedName: "Dana",
      capturedEmail: null,
      embedDomain: "www.vendingpreneurs.com",
      timeZone: "America/Chicago",
      via: "quick_action",
    });
    expect(result).toEqual({ message: calendarMessage, append: true });
  });

  it("does not stack a second calendar right under the one already showing", async () => {
    const d = deps();
    const result = await quickActionTurn(
      {
        behavior: { type: "calendar" },
        label: "Book a call",
        conversation,
        transcript: [calendarMessage],
        embedDomain: null,
      },
      d,
    );
    expect(d.openCalendar).not.toHaveBeenCalled();
    expect(result).toEqual({ message: calendarMessage, append: false });
  });

  it("re-opens the calendar when the chat has moved on since", async () => {
    const d = deps();
    const result = await quickActionTurn(
      {
        behavior: { type: "calendar" },
        label: "Book a call",
        conversation,
        transcript: [
          calendarMessage,
          { role: "user", content: "hmm", ts: calendarMessage.ts },
        ],
        embedDomain: null,
      },
      d,
    );
    expect(result?.append).toBe(true);
  });

  it("returns null when the calendar cannot be built", async () => {
    const result = await quickActionTurn(
      {
        behavior: { type: "calendar" },
        label: "Book a call",
        conversation,
        transcript: [],
        embedDomain: null,
      },
      { openCalendar: async () => null },
    );
    expect(result).toBeNull();
  });

  it("shows the roadmap card in chat, linking the form while no email is on file", async () => {
    const result = await quickActionTurn(
      {
        behavior: { type: "resource", key: "roadmap" },
        label: "Free 90-day roadmap",
        conversation,
        transcript: [],
        embedDomain: null,
      },
      deps(),
    );
    expect(result?.append).toBe(true);
    expect(result?.message).toMatchObject({
      kind: "shared_resource",
      data: {
        label: "Free 90-day roadmap",
        via: "quick_action",
        url: "/resources/roadmap",
      },
    });
  });

  it("links the delivered roadmap page once the chat has their email, marked as a chat link", async () => {
    const result = await quickActionTurn(
      {
        behavior: { type: "resource", key: "roadmap" },
        label: "Free 90-day roadmap",
        conversation: { ...conversation, captured_email: "dana@example.com" },
        transcript: [],
        embedDomain: null,
      },
      deps(),
    );
    expect(result?.message.data?.url).toBe(
      "/resources/roadmap-thank-you?via=chat",
    );
  });

  it("does not repeat the same card twice in a row", async () => {
    const first = await quickActionTurn(
      {
        behavior: { type: "resource", key: "roadmap" },
        label: "Free 90-day roadmap",
        conversation,
        transcript: [],
        embedDomain: null,
      },
      deps(),
    );
    const again = await quickActionTurn(
      {
        behavior: { type: "resource", key: "roadmap" },
        label: "Free 90-day roadmap",
        conversation,
        transcript: [first!.message],
        embedDomain: null,
      },
      deps(),
    );
    expect(again).toEqual({ message: first!.message, append: false });
  });
});
