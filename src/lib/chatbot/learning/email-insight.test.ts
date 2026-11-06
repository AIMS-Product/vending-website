import { describe, expect, it, vi } from "vitest";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";

vi.mock("server-only", () => ({}));
const { runLearningEngine } = await import("./engine");

const NOW = new Date("2026-11-10T12:00:00Z");
const ago = (h: number) =>
  new Date(NOW.getTime() - h * 3_600_000).toISOString();
const conv = (id: string, messages: ChatbotMessage[], booked = false) => ({
  id,
  status: "lead_captured",
  createdAt: ago(120),
  lastMessageAt: messages[messages.length - 1].ts,
  messages,
  capturedName: null,
  capturedEmail: `${id}@example.com`,
  capturedPhone: null,
  prospectProfile: null,
  flags: [],
  booked,
  handedOff: false,
});
const chat: ChatbotMessage = { role: "user", content: "hi", ts: ago(120) };
const sent = (step: string, h: number): ChatbotMessage => ({
  role: "assistant",
  content: step,
  ts: ago(h),
  kind: "email_sent",
  data: { step },
});

describe("email agent insight", () => {
  it("counts emailed, replied, booked and went quiet, with the replies as evidence", () => {
    const { insights } = runLearningEngine(
      [
        conv("quiet", [
          chat,
          sent("follow_up", 100),
          sent("nudge", 76),
          sent("final", 30),
        ]),
        conv(
          "replied",
          [
            chat,
            sent("follow_up", 100),
            {
              role: "user",
              content: "Tuesday works",
              ts: ago(90),
              kind: "email_received",
              data: {},
            },
          ],
          true,
        ),
        conv("chat-only", [chat]),
      ],
      { now: NOW },
    );
    const email = insights.find((i) => i.dedupeKey === "insight:email_agent");
    expect(email?.evidence).toMatchObject({
      emailed: 2,
      replied: 1,
      booked: 1,
      wentQuiet: 1,
      replies: [expect.objectContaining({ text: "Tuesday works" })],
    });
  });
});
