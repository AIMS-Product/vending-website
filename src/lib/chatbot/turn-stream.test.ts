import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const streamChatbotReply = vi.hoisted(() => vi.fn());
const runChatbotTool = vi.hoisted(() => vi.fn());
const resolveBookingCalendar = vi.hoisted(() => vi.fn());

vi.mock("@/lib/chatbot/availability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./availability")>()),
  resolveBookingCalendar,
}));

vi.mock("@/lib/chatbot/openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./openai")>()),
  streamChatbotReply,
}));
vi.mock("@/lib/chatbot/tools", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./tools")>()),
  runChatbotTool,
}));

const { createTurnStream } = await import("./turn-stream");
import type { ChatbotMessage } from "./conversation-store";
import type { ChatbotToolContext } from "./tools";
import type { PriceLeak } from "./price-guard";

/**
 * Builds an OpenAI-shaped SSE response. `chunkSize` deliberately slices the
 * body at arbitrary byte offsets so the parser is exercised against split
 * `data:` lines — the failure mode a naive per-chunk JSON.parse would hit in
 * production and never in a happy-path test.
 */
function sseResponse(events: unknown[], chunkSize = 4096): Response {
  const body = `${events
    .map((event) => `data: ${JSON.stringify(event)}`)
    .join("\n\n")}\n\ndata: [DONE]\n\n`;
  const bytes = new TextEncoder().encode(body);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(stream);
}

function textEvent(content: string) {
  return { choices: [{ delta: { content } }] };
}

function toolCallEvents(name: string, args: string) {
  // OpenAI fragments a tool call across deltas: the id and name land first,
  // then the arguments arrive a few characters at a time.
  return [
    {
      choices: [
        {
          delta: {
            tool_calls: [
              { index: 0, id: "call_1", function: { name, arguments: "" } },
            ],
          },
        },
      ],
    },
    ...Array.from(args).map((char) => ({
      choices: [
        {
          delta: {
            tool_calls: [{ index: 0, function: { arguments: char } }],
          },
        },
      ],
    })),
  ];
}

async function readFrames(stream: ReadableStream<Uint8Array>) {
  const text = await new Response(stream).text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function makeInput(overrides: Record<string, unknown> = {}) {
  const sink: { messages: ChatbotMessage[]; priceLeak?: PriceLeak } = {
    messages: [],
  };
  const captured = { name: null, email: null, phone: null } as {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  return {
    input: {
      config: { model: "gpt-4o-mini" },
      modelMessages: [{ role: "system" as const, content: "system" }],
      sink,
      captured,
      toolContext: {
        conversationId: "conv-1",
        transcript: [],
      } as unknown as ChatbotToolContext,
      ...overrides,
    },
    sink,
    captured,
  };
}

beforeEach(() => {
  streamChatbotReply.mockReset();
  runChatbotTool.mockReset();
  resolveBookingCalendar.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createTurnStream", () => {
  // Changed 2026-09-11 on purpose: replies are held until checked, so the
  // visitor never sees raw model text, only the final checked reply.
  it("sends a plain reply whole, once checked, and records it once", async () => {
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse([textEvent("Hey "), textEvent("there.")]),
    );
    const { input, sink } = makeInput();

    const frames = await readFrames(createTurnStream(input));

    expect(frames.filter((f) => f.t === "text")).toEqual([]);
    expect(frames.at(-1)).toEqual({ t: "flush", v: "Hey there." });
    expect(sink.messages).toHaveLength(1);
    expect(sink.messages[0].content).toBe("Hey there.");
    expect(streamChatbotReply).toHaveBeenCalledTimes(1);
  });

  it("reassembles a tool call split across chunk boundaries", async () => {
    // One byte at a time: every `data:` line is split mid-JSON.
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse(
        toolCallEvents("show_booking_calendar", '{"reason":"cost"}'),
        1,
      ),
    );
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse([textEvent("Grab a time above.")]),
    );
    runChatbotTool.mockResolvedValueOnce({
      result: "calendar shown",
      message: {
        role: "assistant",
        content: "Opened the booking calendar in the chat.",
        ts: "2026-08-21T00:00:00.000Z",
        kind: "calendar",
        data: { url: "https://calendly.com/x" },
      },
    });
    const { input, sink } = makeInput();

    const frames = await readFrames(createTurnStream(input));

    expect(runChatbotTool).toHaveBeenCalledWith(
      "show_booking_calendar",
      '{"reason":"cost"}',
      expect.anything(),
    );
    expect(
      frames.some((f) => f.t === "status" && f.v === "finding_times"),
    ).toBe(true);
    expect(frames.some((f) => f.t === "msg" && f.kind === "calendar")).toBe(
      true,
    );
    expect(sink.messages.map((m) => m.kind)).toEqual(["calendar", undefined]);
  });

  it("offers tools on the first call only, so a turn cannot loop", async () => {
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse(toolCallEvents("capture_contact", "{}")),
    );
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse([textEvent("Got it.")]),
    );
    runChatbotTool.mockResolvedValueOnce({ result: "saved" });

    await readFrames(createTurnStream(makeInput().input));

    expect(streamChatbotReply).toHaveBeenCalledTimes(2);
    expect(streamChatbotReply.mock.calls[0][0].tools).toBeDefined();
    expect(streamChatbotReply.mock.calls[1][0].tools).toBeUndefined();
  });

  it("sends the assistant tool-call turn back before the tool results", async () => {
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse(toolCallEvents("capture_contact", "{}")),
    );
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse([textEvent("Got it.")]),
    );
    runChatbotTool.mockResolvedValueOnce({ result: "saved" });
    const { input } = makeInput();

    await readFrames(createTurnStream(input));

    // OpenAI rejects a `tool` message that does not answer an immediately
    // preceding assistant tool_calls message.
    const secondCall = streamChatbotReply.mock.calls[1][0].messages;
    const assistantTurn = secondCall.at(-2);
    const toolTurn = secondCall.at(-1);
    expect(assistantTurn.role).toBe("assistant");
    expect(assistantTurn.tool_calls[0].id).toBe("call_1");
    expect(toolTurn).toMatchObject({
      role: "tool",
      tool_call_id: "call_1",
      content: "saved",
    });
  });

  it("merges a tool capture without overwriting details already on file", async () => {
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse(toolCallEvents("capture_contact", "{}")),
    );
    streamChatbotReply.mockResolvedValueOnce(sseResponse([textEvent("Ok.")]));
    runChatbotTool.mockResolvedValueOnce({
      result: "saved",
      capture: { name: "Dana", email: "new@example.com", phone: null },
    });
    const { input, captured } = makeInput();
    captured.email = "original@example.com";
    input.captured = captured;

    await readFrames(createTurnStream(input));

    expect(captured.name).toBe("Dana");
    expect(captured.email).toBe("original@example.com");
  });

  it("says something human when OpenAI fails before any output", async () => {
    streamChatbotReply.mockRejectedValueOnce(new Error("upstream down"));
    const { input, sink } = makeInput();

    const frames = await readFrames(createTurnStream(input));

    expect(frames.some((f) => f.t === "text")).toBe(true);
    expect(sink.messages).toHaveLength(1);
    expect(sink.messages[0].content).toContain("Mind sending that again");
  });

  it("keeps a partial reply rather than replacing it with the fallback", async () => {
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse([textEvent("Half a thou")]),
    );
    streamChatbotReply.mockRejectedValueOnce(new Error("upstream down"));
    const { input, sink } = makeInput();

    await readFrames(createTurnStream(input));

    expect(sink.messages).toHaveLength(1);
    expect(sink.messages[0].content).toBe("Half a thou");
  });

  it("never looks up the calendar for a reply with no dates or times", async () => {
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse([textEvent("What do you do for work now?")]),
    );
    const { input } = makeInput();

    await readFrames(createTurnStream(input));

    expect(resolveBookingCalendar).not.toHaveBeenCalled();
  });

  it("replaces a stated price before the visitor sees it, and records it", async () => {
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse([textEvent("Most members spend about $5,000 to get started.")]),
    );
    const { input, sink } = makeInput();

    const frames = await readFrames(createTurnStream(input));

    const shown = frames.at(-1)?.v as string;
    expect(shown).not.toContain("$");
    expect(shown).toContain("on the free call");
    expect(sink.messages[0].content).toBe(shown);
    expect(sink.priceLeak?.amount).toBe("$5,000");
  });

  // Conversation 68ead512: "Monday the 15th is full" while Tue Sep 15 had
  // open slots. The visitor must only ever see the checked version.
  it("corrects a false 'fully booked' against the real calendar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-11T12:50:00Z"));
    try {
      resolveBookingCalendar.mockResolvedValue({
        calendar: { label: "test", url: "https://calendly.com/x", eventTypeUri: "x" },
        slots: ["2026-09-15T13:00:00Z", "2026-09-15T20:30:00Z"],
      });
      streamChatbotReply.mockResolvedValueOnce(
        sseResponse([textEvent("Monday the 15th is fully booked.")]),
      );
      const { input, sink } = makeInput({
        toolContext: {
          conversationId: "conv-1",
          transcript: [],
          timeZone: "America/New_York",
        } as unknown as ChatbotToolContext,
      });

      const frames = await readFrames(createTurnStream(input));

      const corrected =
        "Tuesday, Sep 15 has 9:00 am or 4:30 pm open. Would one of those work?";
      expect(frames.filter((f) => f.t === "text")).toEqual([]);
      expect(frames.at(-1)).toEqual({ t: "flush", v: corrected });
      expect(sink.messages[0].content).toBe(corrected);
    } finally {
      vi.useRealTimers();
    }
  });
});
