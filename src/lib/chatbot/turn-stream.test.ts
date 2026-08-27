import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const streamChatbotReply = vi.hoisted(() => vi.fn());
const runChatbotTool = vi.hoisted(() => vi.fn());

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
  const sink: { messages: ChatbotMessage[] } = { messages: [] };
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createTurnStream", () => {
  it("streams a plain reply and records it once", async () => {
    streamChatbotReply.mockResolvedValueOnce(
      sseResponse([textEvent("Hey "), textEvent("there.")]),
    );
    const { input, sink } = makeInput();

    const frames = await readFrames(createTurnStream(input));

    expect(frames.filter((f) => f.t === "text").map((f) => f.v)).toEqual([
      "Hey ",
      "there.",
    ]);
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
});
