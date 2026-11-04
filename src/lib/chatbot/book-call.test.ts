import { describe, expect, it, vi } from "vitest";
import { bookCall, proposeCallTime, type BookCallDeps } from "./book-call";
import { namesATime } from "./book-call-intent";
import type { ChatbotMessage } from "./conversation-store";
import { CalendlyApiError } from "@/lib/services/calendly-api";

const SLOT = "2026-11-06T20:00:00Z"; // Fri 2:00 PM Central
const EVENT_TYPE = "https://api.calendly.com/event_types/primary";
const NOW = new Date("2026-11-04T18:00:00Z");

function deps(overrides: Partial<BookCallDeps> = {}) {
  const createInvitee = vi.fn().mockResolvedValue({
    uri: "https://api.calendly.com/scheduled_events/E1/invitees/I1",
    event: "https://api.calendly.com/scheduled_events/E1",
    status: "active",
    tracking: { utm_content: "conv-1" },
  });
  const getScheduledEvent = vi.fn().mockResolvedValue({
    name: "Vendingpreneurs Consultation Call",
    start_time: SLOT,
  });
  const getEventTypeQuestions = vi
    .fn()
    .mockResolvedValue([
      {
        name: "What's your phone number?",
        type: "phone_number",
        required: true,
        position: 0,
      },
    ]);
  const record = vi.fn().mockResolvedValue(undefined);
  const full: BookCallDeps = {
    resolveCalendar: vi.fn().mockResolvedValue({
      calendar: {
        url: "https://calendly.com/x",
        eventTypeUri: EVENT_TYPE,
        label: "x",
      },
      slots: [SLOT, "2026-11-06T20:30:00Z"],
    }),
    calendly: () =>
      ({ createInvitee, getScheduledEvent, getEventTypeQuestions }) as never,
    record,
    now: () => NOW,
    ...overrides,
  };
  return { deps: full, createInvitee, record, getEventTypeQuestions };
}

const proposed: ChatbotMessage = {
  role: "assistant",
  content: "Proposed time",
  ts: NOW.toISOString(),
  kind: "booking_proposed",
  data: { start_time: SLOT, event_type_uri: EVENT_TYPE },
};
const user = (content: string): ChatbotMessage => ({
  role: "user",
  content,
  ts: NOW.toISOString(),
});

const context = (transcript: ChatbotMessage[]) => ({
  conversationId: "conv-1",
  capturedName: "Adam",
  capturedEmail: "adam@example.com",
  capturedPhone: "(503) 555-0142",
  transcript,
  timeZone: "America/Chicago",
});

describe("proposeCallTime", () => {
  it("proposes only a slot Calendly reports open", async () => {
    const { deps: d } = deps();
    const ok = await proposeCallTime(
      { day: "2026-11-06", time: "14:00" },
      context([]),
      d,
    );
    expect(ok.message?.kind).toBe("booking_proposed");
    expect(ok.message?.data).toEqual({
      start_time: SLOT,
      event_type_uri: EVENT_TYPE,
    });
    expect(ok.message?.content).toContain("Friday, November 6");

    const closed = await proposeCallTime(
      { day: "2026-11-06", time: "17:00" },
      context([]),
      d,
    );
    expect(closed.message).toBeUndefined();
    expect(closed.result).toContain("not open");
  });

  it("asks for missing contact details in the same message", async () => {
    const { deps: d } = deps();
    const out = await proposeCallTime(
      { day: "2026-11-06", time: "14:00" },
      { ...context([]), capturedEmail: null },
      d,
    );
    expect(out.result).toContain("email");
  });
});

describe("bookCall", () => {
  it("books the proposed slot after the visitor replied, tagged to the chat", async () => {
    const { deps: d, createInvitee, record } = deps();
    const out = await bookCall({}, context([proposed, user("yes book it")]), d);
    expect(out.message?.kind).toBe("booking_confirmed");
    expect(createInvitee).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypeUri: EVENT_TYPE,
        startTime: new Date(SLOT).toISOString(),
        email: "adam@example.com",
        timeZone: "America/Chicago",
        questionsAndAnswers: [
          {
            question: "What's your phone number?",
            answer: "+15035550142",
            position: 0,
          },
        ],
        tracking: expect.objectContaining({
          utm_source: "chatbot",
          utm_medium: "site_chat",
          utm_content: "conv-1",
        }),
      }),
    );
    expect(record).toHaveBeenCalledOnce();
  });

  it("refuses when no time was proposed", async () => {
    const { deps: d, createInvitee } = deps();
    const out = await bookCall({}, context([user("yes")]), d);
    expect(out.message).toBeUndefined();
    expect(createInvitee).not.toHaveBeenCalled();
  });

  it("refuses to book in the same turn it proposed", async () => {
    const { deps: d, createInvitee } = deps();
    const out = await bookCall(
      {},
      context([user("thursday 2pm?"), proposed]),
      d,
    );
    expect(out.result).toContain("not replied");
    expect(createInvitee).not.toHaveBeenCalled();
  });

  it("refuses without a name and email", async () => {
    const { deps: d, createInvitee } = deps();
    const out = await bookCall(
      {},
      { ...context([proposed, user("yes")]), capturedEmail: null },
      d,
    );
    expect(out.message).toBeUndefined();
    expect(createInvitee).not.toHaveBeenCalled();
  });

  it("asks for the phone when the event type requires it", async () => {
    const { deps: d, createInvitee } = deps();
    const out = await bookCall(
      {},
      { ...context([proposed, user("yes")]), capturedPhone: null },
      d,
    );
    expect(out.result).toContain("phone number");
    expect(createInvitee).not.toHaveBeenCalled();
  });

  it("falls back to the calendar on a required question it cannot answer", async () => {
    const { deps: d, createInvitee, getEventTypeQuestions } = deps();
    getEventTypeQuestions.mockResolvedValue([
      {
        name: "What's your budget?",
        type: "string",
        required: true,
        position: 1,
      },
    ]);
    const out = await bookCall({}, context([proposed, user("yes")]), d);
    expect(out.result).toContain("show_booking_calendar");
    expect(createInvitee).not.toHaveBeenCalled();
  });

  it("never books twice in one chat", async () => {
    const { deps: d, createInvitee } = deps();
    const booked: ChatbotMessage = { ...proposed, kind: "booking_confirmed" };
    await bookCall(
      {},
      context([proposed, user("yes"), booked, user("thanks")]),
      d,
    );
    expect(createInvitee).not.toHaveBeenCalled();
  });

  it("falls back to the calendar when Calendly refuses, and never claims a booking", async () => {
    const createInvitee = vi
      .fn()
      .mockRejectedValue(new CalendlyApiError(403, "insufficient scope"));
    const { deps: d, record } = deps({
      calendly: () =>
        ({
          createInvitee,
          getScheduledEvent: vi.fn(),
          getEventTypeQuestions: vi.fn().mockResolvedValue([]),
        }) as never,
    });
    const out = await bookCall({}, context([proposed, user("yes")]), d);
    expect(out.message).toBeUndefined();
    expect(out.result).toContain("show_booking_calendar");
    expect(record).not.toHaveBeenCalled();
  });

  it("offers another time when the slot was just taken", async () => {
    const createInvitee = vi
      .fn()
      .mockRejectedValue(
        new CalendlyApiError(
          400,
          "Calendly API request failed with 400: The selected time is no longer available",
        ),
      );
    const { deps: d } = deps({
      calendly: () =>
        ({
          createInvitee,
          getScheduledEvent: vi.fn(),
          getEventTypeQuestions: vi.fn().mockResolvedValue([]),
        }) as never,
    });
    const out = await bookCall({}, context([proposed, user("yes")]), d);
    expect(out.result).toContain("just taken");
  });
});

describe("namesATime", () => {
  it("spots a named day or clock time, not a general question", () => {
    expect(namesATime("2pm Friday works")).toBe(true);
    expect(namesATime("can we do tomorrow?")).toBe(true);
    expect(namesATime("13:15 is fine")).toBe(true);
    expect(namesATime("how much does it cost")).toBe(false);
    expect(namesATime("I want to book a call")).toBe(false);
  });
});
