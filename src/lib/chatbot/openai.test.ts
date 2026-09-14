import { describe, expect, it } from "vitest";
import { rateLimitWaitMs, streamChatbotReply } from "./openai";

const rateLimited = (message: string) =>
  new Response(JSON.stringify({ error: { message } }), { status: 429 });
const streamOk = () => new Response("data: [DONE]\n\n", { status: 200 });

function fakeFetch(responses: Response[]) {
  const calls = { count: 0 };
  const fetchFn = (async () => {
    calls.count += 1;
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next;
  }) as typeof fetch;
  return { fetchFn, calls };
}

const request = { model: "gpt-4.1", messages: [], apiKey: "test-key" };

describe("rateLimitWaitMs", () => {
  it("reads the wait OpenAI names, plus a small buffer", () => {
    expect(rateLimitWaitMs(new Headers(), "Please try again in 1.672s.")).toBe(1922);
    expect(rateLimitWaitMs(new Headers(), "Please try again in 538ms.")).toBe(788);
    expect(rateLimitWaitMs(new Headers({ "retry-after-ms": "900" }), "")).toBe(900);
  });

  it("returns null when no wait is named (an exhausted quota is also a 429)", () => {
    expect(rateLimitWaitMs(new Headers(), "You exceeded your current quota")).toBeNull();
  });
});

describe("streamChatbotReply on a rate limit", () => {
  it("waits and retries once", async () => {
    const { fetchFn, calls } = fakeFetch([
      rateLimited("Rate limit reached for gpt-4.1. Please try again in 5ms."),
      streamOk(),
    ]);
    const response = await streamChatbotReply({ ...request, fetchFn });
    expect(response.ok).toBe(true);
    expect(calls.count).toBe(2);
  });

  it("does not wait longer than a turn can afford", async () => {
    const { fetchFn, calls } = fakeFetch([
      rateLimited("Rate limit reached for gpt-4.1. Please try again in 15.962s."),
    ]);
    await expect(streamChatbotReply({ ...request, fetchFn })).rejects.toThrow(
      /Rate limit reached/,
    );
    expect(calls.count).toBe(1);
  });

  it("retries at most once", async () => {
    const { fetchFn, calls } = fakeFetch([
      rateLimited("Please try again in 5ms."),
      rateLimited("Please try again in 5ms."),
    ]);
    await expect(streamChatbotReply({ ...request, fetchFn })).rejects.toThrow();
    expect(calls.count).toBe(2);
  });
});
