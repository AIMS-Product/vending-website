import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ config: {} }));

import {
  KIT_WEBSITE_SIGNUP_TAG_ID,
  KitSubscribeError,
  queueKitSubscribe,
  subscribeToKit,
} from "./subscribe";

function fetchReturning(status: number) {
  return vi.fn(
    async () =>
      ({ ok: status < 300, status, text: async () => "nope" }) as Response,
  );
}

describe("subscribeToKit", () => {
  it("upserts the subscriber, then tags them", async () => {
    const fetchImpl = fetchReturning(200);
    await subscribeToKit(
      { email: " Jo@Example.com ", fullName: "Jo Smith" },
      { KIT_API_KEY: "kit_test" },
      fetchImpl as unknown as typeof fetch,
    );
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      "https://api.kit.com/v4/subscribers",
      `https://api.kit.com/v4/tags/${KIT_WEBSITE_SIGNUP_TAG_ID}/subscribers`,
    ]);
    expect(JSON.parse(calls[0][1].body as string)).toEqual({
      email_address: "jo@example.com",
      first_name: "Jo",
    });
  });

  it("throws on a Kit error so the queue retries", async () => {
    await expect(
      subscribeToKit(
        { email: "jo@example.com", fullName: null },
        { KIT_API_KEY: "kit_test" },
        fetchReturning(422) as unknown as typeof fetch,
      ),
    ).rejects.toBeInstanceOf(KitSubscribeError);
  });
});

describe("queueKitSubscribe", () => {
  it("does nothing without a key", async () => {
    const from = vi.fn();
    expect(
      await queueKitSubscribe(
        { from } as never,
        { leadSubmissionId: "l1", nowIso: "2026-10-01T00:00:00Z" },
        {},
      ),
    ).toBe("disabled");
    expect(from).not.toHaveBeenCalled();
  });

  it("never throws when the insert is rejected", async () => {
    const single = vi.fn(async () => ({ error: { code: "23514" } }));
    const from = vi.fn(() => ({
      insert: () => ({ select: () => ({ single }) }),
    }));
    expect(
      await queueKitSubscribe(
        { from } as never,
        { leadSubmissionId: "l1", nowIso: "2026-10-01T00:00:00Z" },
        { KIT_API_KEY: "kit_test" },
      ),
    ).toBe("failed");
  });
});
