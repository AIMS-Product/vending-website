import { describe, expect, it, vi } from "vitest";
import { createCloseClient } from "./client";

function stubFetch(payload: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

function client(fetchImpl: typeof fetch) {
  return createCloseClient({
    apiKey: "test-key",
    baseUrl: "https://api.close.test/api/v1",
    fetchImpl,
  });
}

describe("searchContactsByEmail", () => {
  it("searches leads with an exact email query instead of the ignored /contact/ filter", async () => {
    const fetchImpl = stubFetch({ data: [] });

    await client(fetchImpl).searchContactsByEmail("lead@example.com");

    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe(
      `https://api.close.test/api/v1/lead/?query=${encodeURIComponent(
        'email:"lead@example.com"',
      )}&_limit=10`,
    );
  });

  it("returns only the contacts whose email matches exactly", async () => {
    // Close's lead search is fuzzy: a matched lead can carry sibling contacts
    // with completely different addresses. Those must not count as matches, or
    // the duplicate guard parks every lead.
    const fetchImpl = stubFetch({
      data: [
        {
          id: "lead_1",
          contacts: [
            { id: "cont_1", emails: [{ email: "Lead@Example.com" }] },
            { id: "cont_2", emails: [{ email: "someone-else@example.com" }] },
          ],
        },
      ],
    });

    const result =
      await client(fetchImpl).searchContactsByEmail("lead@example.com");

    expect(result.data).toEqual([
      {
        id: "cont_1",
        lead_id: "lead_1",
        lead_date_updated: null,
        emails: [{ email: "Lead@Example.com" }],
      },
    ]);
  });

  it("reports one match per contact across every matched lead", async () => {
    const fetchImpl = stubFetch({
      data: [
        {
          id: "lead_1",
          contacts: [{ id: "cont_1", emails: [{ email: "dup@example.com" }] }],
        },
        {
          id: "lead_2",
          contacts: [{ id: "cont_2", emails: [{ email: "dup@example.com" }] }],
        },
      ],
    });

    const result =
      await client(fetchImpl).searchContactsByEmail("dup@example.com");

    expect(result.data.map((contact) => contact.id)).toEqual([
      "cont_1",
      "cont_2",
    ]);
  });

  it("treats a no-hit search as no existing contact", async () => {
    const fetchImpl = stubFetch({});

    const result =
      await client(fetchImpl).searchContactsByEmail("nobody@example.com");

    expect(result.data).toEqual([]);
  });

  it("strips quotes so an odd address cannot break out of the query", async () => {
    const fetchImpl = stubFetch({ data: [] });

    await client(fetchImpl).searchContactsByEmail('we"ird@example.com');

    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toContain(encodeURIComponent('email:"weird@example.com"'));
  });
});

describe("createNote", () => {
  it("posts to /activity/note/ with the lead id and note body", async () => {
    const fetchImpl = stubFetch({ id: "acti_1" });

    await client(fetchImpl).createNote({
      lead_id: "lead_1",
      note_html: "<body><p>hi</p></body>",
    });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("https://api.close.test/api/v1/activity/note/");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      lead_id: "lead_1",
      note_html: "<body><p>hi</p></body>",
    });
  });
});

describe("listLeadNotes", () => {
  it("filters by lead id", async () => {
    const fetchImpl = stubFetch({ data: [{ id: "acti_1", note: "hi" }] });

    const result = await client(fetchImpl).listLeadNotes("lead_1");

    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe(
      "https://api.close.test/api/v1/activity/note/?lead_id=lead_1&_limit=50",
    );
    expect(result.data).toEqual([{ id: "acti_1", note: "hi" }]);
  });
});

describe("rate limits", () => {
  it("waits out a 429 for the retry-after Close sends, then succeeds", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          new Response("", { status: 429, headers: { "retry-after": "2" } }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "lead_1" }), { status: 200 }),
        );

      const pending = client(fetchImpl as unknown as typeof fetch).getLead(
        "lead_1",
      );
      await vi.advanceTimersByTimeAsync(1999);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toEqual({ id: "lead_1" });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up after three attempts and reports the 429", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        async () =>
          new Response("", { status: 429, headers: { "retry-after": "1" } }),
      );

      const pending = client(fetchImpl as unknown as typeof fetch).getLead(
        "lead_1",
      );
      const settled = expect(pending).rejects.toThrow(
        "Close API request failed with 429",
      );
      await vi.advanceTimersByTimeAsync(5000);
      await settled;
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
