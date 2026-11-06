import { describe, expect, it } from "vitest";
import type { ChatbotMessage } from "@/lib/chatbot/conversation-store";
import { wentQuiet } from "./quiet";

const NOW = new Date("2026-11-10T12:00:00Z");
const hoursAgo = (h: number) =>
  new Date(NOW.getTime() - h * 3_600_000).toISOString();
const sent = (step: string, h: number): ChatbotMessage => ({
  role: "assistant",
  content: `email ${step}`,
  ts: hoursAgo(h),
  kind: "email_sent",
  data: { step },
});
const got = (h: number, stop = false): ChatbotMessage => ({
  role: "user",
  content: "reply",
  ts: hoursAgo(h),
  kind: "email_received",
  data: { stop },
});
const chat: ChatbotMessage = { role: "user", content: "hi", ts: hoursAgo(200) };

describe("wentQuiet", () => {
  it("no reply a day after the last automatic email", () => {
    const msgs = [
      chat,
      sent("follow_up", 100),
      sent("nudge", 76),
      sent("final", 25),
    ];
    expect(wentQuiet(msgs, NOW)).toBe("no_reply");
    expect(wentQuiet(msgs.slice(0, 3), NOW)).toBeNull(); // sequence still running
    expect(wentQuiet([chat, sent("final", 5)], NOW)).toBeNull(); // too soon
  });
  it("a reply thread where Mia had the last word two days ago", () => {
    expect(
      wentQuiet(
        [chat, sent("follow_up", 100), got(80), sent("reply", 49)],
        NOW,
      ),
    ).toBe("replied_then_quiet");
    expect(
      wentQuiet(
        [chat, sent("follow_up", 100), got(80), sent("reply", 10)],
        NOW,
      ),
    ).toBeNull();
    expect(wentQuiet([chat, sent("follow_up", 100), got(60)], NOW)).toBeNull();
  });
  it("never after a stop or a booking", () => {
    expect(wentQuiet([chat, sent("final", 30), got(28, true)], NOW)).toBeNull();
    expect(
      wentQuiet(
        [
          chat,
          sent("final", 30),
          {
            role: "assistant",
            content: "booked",
            ts: hoursAgo(29),
            kind: "booking_confirmed",
          },
        ],
        NOW,
      ),
    ).toBeNull();
  });
});
