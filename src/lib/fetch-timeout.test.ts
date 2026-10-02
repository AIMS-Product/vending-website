import { describe, expect, it, vi } from "vitest";
import { FetchTimeoutError, fetchWithTimeout } from "./fetch-timeout";

/** A fetch that never answers, and rejects the way undici does when aborted. */
function hangingFetch() {
  return vi.fn(
    (_input: string | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(init.signal?.reason),
        );
      }),
  );
}

// AbortSignal.timeout runs on the platform clock, not vitest's fake one, so
// these use a real 20ms deadline.
describe("fetchWithTimeout", () => {
  it("passes an abort signal and returns the response", async () => {
    const response = new Response("ok");
    const fetchImpl = vi.fn(
      async (_input: string | URL, _init?: RequestInit) => response,
    );

    const result = await fetchWithTimeout(
      fetchImpl,
      "https://example.test/a",
      { method: "GET" },
      { label: "Example" },
    );

    expect(result).toBe(response);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("GET");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("turns a hung upstream into a named timeout error", async () => {
    const pending = fetchWithTimeout(
      hangingFetch(),
      "https://example.test/a",
      {},
      { label: "Example", timeoutMs: 20 },
    );

    await expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);
    await expect(pending).rejects.toThrow("Example timed out after 20ms.");
  });

  it("lets a client raise its own typed error", async () => {
    class ClientError extends Error {}

    const pending = fetchWithTimeout(
      hangingFetch(),
      "https://example.test/a",
      {},
      {
        label: "Example",
        timeoutMs: 20,
        onTimeout: (error) => new ClientError(error.message),
      },
    );

    await expect(pending).rejects.toBeInstanceOf(ClientError);
  });

  it("rethrows other failures untouched", async () => {
    const failure = new Error("connection refused");

    await expect(
      fetchWithTimeout(
        () => Promise.reject(failure),
        "https://example.test/a",
        {},
        { label: "Example" },
      ),
    ).rejects.toBe(failure);
  });
});
