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
} from "./marketing-links";

function buildClient(insertError: unknown = null) {
  const inserted: Array<Record<string, unknown>> = [];
  const from = vi.fn((table: string) => {
    if (table !== "marketing_links") throw new Error(`Unexpected ${table}`);
    return {
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
};

describe("createMarketingLink", () => {
  beforeEach(() => {
    mocks.config.BITLY_ACCESS_TOKEN = undefined;
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
