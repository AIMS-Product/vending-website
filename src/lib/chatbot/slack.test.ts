import { describe, expect, it, vi } from "vitest";
import { postChatbotLeadToSlack } from "./slack";

function conversation(
  messages: { role: "user" | "assistant"; content: string }[],
) {
  return {
    id: "conv-1",
    personaName: "Mia",
    handedOff: false,
    capturedName: "Jane",
    capturedEmail: "jane@example.com",
    capturedPhone: null,
    pageUrl: "/apply",
    messages: messages.map((m) => ({ ...m, ts: "2026-08-01T00:00:00.000Z" })),
  };
}

describe("postChatbotLeadToSlack", () => {
  it("does nothing and reports failure when SLACK_WEBHOOK_URL is not set", async () => {
    const fetchImpl = vi.fn();
    const ok = await postChatbotLeadToSlack(conversation([]), null, {
      fetchImpl,
    });
    expect(ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never throws on a rejecting fetch and reports failure", async () => {
    const original = process.env.SLACK_WEBHOOK_URL;
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/webhook";
    vi.resetModules();
    const { postChatbotLeadToSlack: post } = await import("./slack");
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      post(conversation([{ role: "user", content: "hi" }]), null, {
        fetchImpl,
      }),
    ).resolves.toBe(false);

    process.env.SLACK_WEBHOOK_URL = original;
  });

  it("truncates the transcript to fit the Slack payload budget, keeping the most recent messages", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/webhook";
    vi.resetModules();
    const { postChatbotLeadToSlack: post } = await import("./slack");

    const longMessages: { role: "user" | "assistant"; content: string }[] =
      Array.from({ length: 80 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message number ${i} with some extra padding text to grow the payload size well past the Slack budget.`,
      }));

    let body = "";
    const fetchImpl = vi.fn().mockImplementation((_url, init) => {
      body = JSON.parse(init.body as string).text as string;
      return Promise.resolve({ ok: true } as Response);
    });

    const ok = await post(conversation(longMessages), null, { fetchImpl });

    expect(ok).toBe(true);
    expect(body.length).toBeLessThanOrEqual(3500);
    expect(body).toContain(
      "(earlier messages truncated — full transcript in admin)",
    );
    // The most recent message must survive truncation.
    expect(body).toContain("Message number 79");
    // An early message must have been dropped.
    expect(body).not.toContain("Message number 0 with");
  });
});
