import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BitlyClient } from "@/lib/bitly/client";

const mocks = vi.hoisted(() => ({
  config: {
    BITLY_ACCESS_TOKEN: undefined as string | undefined,
    BITLY_GROUP_GUID: "Bgrp" as string | undefined,
  },
}));

vi.mock("@/lib/config", () => ({ config: mocks.config }));

import {
  createMarketingLink,
  MarketingLinkServiceError,
  updateMarketingLinkMeta,
} from "./marketing-links";

function buildClient(
  insertError: unknown = null,
  existing: Array<Record<string, unknown>> = [],
) {
  const inserted: Array<Record<string, unknown>> = [];
  const from = vi.fn((table: string) => {
    if (table !== "marketing_links") throw new Error(`Unexpected ${table}`);
    const filters: Record<string, unknown> = {};
    const lookup = {
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return Object.assign(
          Promise.resolve({
            data: existing.filter((row) =>
              Object.entries(filters).every(([k, v]) => row[k] === v),
            ),
            error: null,
          }),
          lookup,
        );
      },
    };
    return {
      select: () => lookup,
      insert: vi.fn((row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({
              data: insertError ? null : { id: "link-1", ...row },
              error: insertError,
            }),
          }),
        };
      }),
    };
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    inserted,
  };
}

const input = {
  baseUrl: "https://www.vendingpreneurs.com/book",
  source: "instagram",
  medium: "organic",
  campaign: "webinar-sept15",
  content: "post-1",
  destination: "webinar-register",
  funnelName: "Internal Webinar",
};

describe("createMarketingLink", () => {
  beforeEach(() => {
    mocks.config.BITLY_ACCESS_TOKEN = undefined;
  });

  it("refuses a second link with the same five tags, before minting anything", async () => {
    const { client, inserted } = buildClient(null, [
      {
        url: "https://www.vendingpreneurs.com/book?x",
        bitly_url: null,
        utm_source: "instagram",
        utm_medium: "organic",
        utm_campaign: "webinar-sept15",
        utm_content: "POST-1",
        utm_term: "webinar-register",
      },
    ]);
    await expect(
      createMarketingLink(input, { createdBy: "a@b.c", client, bitly: null }),
    ).rejects.toThrow(/already exists/);
    expect(inserted).toHaveLength(0);
  });

  it("stores the finished URL with the five UTMs as columns", async () => {
    const { client, inserted } = buildClient();

    const row = await createMarketingLink(input, {
      createdBy: "adam@example.com",
      client,
      bitly: null,
    });

    expect(inserted[0]).toMatchObject({
      url: "https://www.vendingpreneurs.com/book?utm_source=instagram&utm_medium=organic&utm_campaign=webinar-sept15&utm_content=post-1&utm_term=webinar-register",
      utm_source: "instagram",
      utm_term: "webinar-register",
      bitly_id: null,
      created_by: "adam@example.com",
    });
    expect(row.id).toBe("link-1");
  });

  it("rejects a value off the closed lists with the form-facing message", async () => {
    const { client, inserted } = buildClient();

    await expect(
      createMarketingLink(
        { ...input, destination: "homepage" },
        { createdBy: "a@b.c", client, bitly: null },
      ),
    ).rejects.toThrow(MarketingLinkServiceError);
    expect(inserted).toHaveLength(0);
  });

  it("mints a Bitly short link when asked and stores its id", async () => {
    const { client, inserted } = buildClient();
    const createBitlink = vi.fn(async () => ({
      id: "bit.ly/abc",
      link: "https://bit.ly/abc",
      longUrl: "x",
      title: null,
    }));
    const bitly = { createBitlink } as unknown as BitlyClient;

    await createMarketingLink(
      { ...input, mintShortLink: true, label: "IG bio" },
      { createdBy: "a@b.c", client, bitly },
    );

    expect(createBitlink).toHaveBeenCalledWith({
      longUrl: expect.stringContaining("utm_term=webinar-register"),
      groupGuid: "Bgrp",
      title: "IG bio",
    });
    expect(inserted[0]).toMatchObject({
      bitly_id: "bit.ly/abc",
      bitly_url: "https://bit.ly/abc",
    });
  });

  it("refuses to mint when Bitly is not connected, and saves nothing", async () => {
    const { client, inserted } = buildClient();

    await expect(
      createMarketingLink(
        { ...input, mintShortLink: true },
        { createdBy: "a@b.c", client, bitly: null },
      ),
    ).rejects.toThrow(/Bitly is not connected/);
    expect(inserted).toHaveLength(0);
  });

  it("does not save the long link when the Bitly mint fails", async () => {
    const { client, inserted } = buildClient();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const bitly = {
      createBitlink: vi.fn(async () => {
        throw new Error("403");
      }),
    } as unknown as BitlyClient;

    await expect(
      createMarketingLink(
        { ...input, mintShortLink: true },
        { createdBy: "a@b.c", client, bitly },
      ),
    ).rejects.toThrow(/Bitly could not create/);
    expect(inserted).toHaveLength(0);
    consoleError.mockRestore();
  });
});

describe("funnel and owner", () => {
  it("refuses a new link without a funnel", async () => {
    const { client, inserted } = buildClient();
    await expect(
      createMarketingLink(
        { ...input, funnelName: "" },
        { createdBy: "jess@x", client, bitly: null },
      ),
    ).rejects.toThrow("Pick the funnel this link feeds.");
    expect(inserted).toHaveLength(0);
  });

  it("refuses a funnel that is not a Close choice", async () => {
    const { client, inserted } = buildClient();
    await expect(
      createMarketingLink(
        { ...input, funnelName: "mike instagram" },
        { createdBy: "jess@x", client, bitly: null },
      ),
    ).rejects.toBeInstanceOf(MarketingLinkServiceError);
    expect(inserted).toHaveLength(0);
  });

  it("stores the funnel, who set it, and the owner", async () => {
    const { client, inserted } = buildClient();
    await createMarketingLink(
      { ...input, owner: " Anthony " },
      { createdBy: "jess@x", client, bitly: null },
    );
    expect(inserted[0]).toMatchObject({
      funnel_name: "Internal Webinar",
      funnel_set_by: "jess@x",
      owner: "Anthony",
    });
  });
});

describe("updateMarketingLinkMeta", () => {
  function updateClient(result: { data: unknown; error: unknown }) {
    const calls: { patch?: Record<string, unknown>; id?: unknown } = {};
    const from = vi.fn(() => ({
      update: (patch: Record<string, unknown>) => {
        calls.patch = patch;
        return {
          eq: (_column: string, id: unknown) => {
            calls.id = id;
            return {
              select: () => ({ maybeSingle: async () => result }),
            };
          },
        };
      },
    }));
    return {
      client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
      calls,
    };
  }

  it("sets funnel, owner and note, never the tags", async () => {
    const { client, calls } = updateClient({
      data: { id: "l1", funnel_name: "VSL", owner: null, label: "x" },
      error: null,
    });
    await updateMarketingLinkMeta(
      "l1",
      { funnelName: "VSL", owner: "", label: " x " },
      { editedBy: "jess@x", client },
    );
    expect(calls.id).toBe("l1");
    expect(calls.patch).toEqual({
      funnel_name: "VSL",
      funnel_set_by: "jess@x",
      owner: null,
      label: "x",
    });
  });

  it("clears who set the funnel when the funnel is cleared", async () => {
    const { client, calls } = updateClient({
      data: { id: "l1", funnel_name: null, owner: null, label: null },
      error: null,
    });
    await updateMarketingLinkMeta(
      "l1",
      { funnelName: "" },
      { editedBy: "jess@x", client },
    );
    expect(calls.patch).toMatchObject({
      funnel_name: null,
      funnel_set_by: null,
    });
  });

  it("refuses an unknown funnel and reports a missing row", async () => {
    const { client } = updateClient({ data: null, error: null });
    await expect(
      updateMarketingLinkMeta(
        "l1",
        { funnelName: "Newsletter" },
        { editedBy: "a", client },
      ),
    ).rejects.toBeInstanceOf(MarketingLinkServiceError);
    await expect(
      updateMarketingLinkMeta(
        "gone",
        { funnelName: "VSL" },
        { editedBy: "a", client },
      ),
    ).rejects.toThrow("That link no longer exists.");
  });
});
