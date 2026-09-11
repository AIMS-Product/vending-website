import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildStandardLink,
  linkStandardSchema,
} from "@/lib/analytics/link-standard";
import { createBitlyClient, type BitlyClient } from "@/lib/bitly/client";
import { config } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";

type LinksClient = Pick<SupabaseClient<Database>, "from">;

export type MarketingLink = Tables<"marketing_links">;

export class MarketingLinkServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketingLinkServiceError";
  }
}

/** Registry rows shown on /admin/links. Newest first; the page is a log, not a search. */
const DEFAULT_LIST_LIMIT = 200;

export type CreateMarketingLinkInput = {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  destination: string;
  label?: string | null;
  /** Also mint a Bitly short link so clicks join through bitly_link_clicks. */
  mintShortLink?: boolean;
};

/**
 * Validates against the closed lists, writes the URL, optionally mints a Bitly
 * short link, and stores the row. Throws MarketingLinkServiceError with a
 * message fit for the form; anything else is a bug and propagates.
 */
export async function createMarketingLink(
  input: CreateMarketingLinkInput,
  deps: {
    createdBy: string;
    client?: LinksClient;
    /** Explicit null means Bitly is not connected; undefined builds from config. */
    bitly?: BitlyClient | null;
  },
): Promise<MarketingLink> {
  const parsed = linkStandardSchema.safeParse({
    baseUrl: input.baseUrl,
    source: input.source,
    medium: input.medium,
    campaign: input.campaign,
    content: input.content,
    destination: input.destination,
  });
  if (!parsed.success) {
    throw new MarketingLinkServiceError(
      parsed.error.issues[0]?.message ?? "That link is not on the standard.",
    );
  }

  const url = buildStandardLink(parsed.data);
  const label = input.label?.trim() || null;

  let bitlyId: string | null = null;
  let bitlyUrl: string | null = null;
  if (input.mintShortLink) {
    const bitly = deps.bitly === undefined ? bitlyFromConfig() : deps.bitly;
    if (!bitly) {
      throw new MarketingLinkServiceError(
        "Bitly is not connected, so a short link cannot be created. Save without one or set BITLY_ACCESS_TOKEN.",
      );
    }
    try {
      const minted = await bitly.createBitlink({
        longUrl: url,
        groupGuid: config.BITLY_GROUP_GUID ?? null,
        title: label ?? `${parsed.data.campaign} · ${parsed.data.content}`,
      });
      bitlyId = minted.id;
      bitlyUrl = minted.link;
    } catch (error) {
      console.error("marketing link: bitly mint failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : undefined,
      });
      throw new MarketingLinkServiceError(
        "Bitly could not create the short link. The long link was not saved; try again or save without a short link.",
      );
    }
  }

  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("marketing_links")
    .insert({
      url,
      base_url: parsed.data.baseUrl,
      utm_source: parsed.data.source,
      utm_medium: parsed.data.medium,
      utm_campaign: parsed.data.campaign,
      utm_content: parsed.data.content,
      utm_term: parsed.data.destination,
      label,
      bitly_id: bitlyId,
      bitly_url: bitlyUrl,
      created_by: deps.createdBy,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("marketing link insert failed", {
      code: error?.code,
      message: error?.message,
    });
    throw new MarketingLinkServiceError("Could not save the link.");
  }
  return data;
}

export async function listMarketingLinks(
  deps: { client?: LinksClient; limit?: number } = {},
): Promise<MarketingLink[]> {
  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("marketing_links")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(deps.limit ?? DEFAULT_LIST_LIMIT);
  if (error) {
    // The table lands with its own migration; a deploy that beats it shows an
    // empty registry rather than a broken page.
    console.error("marketing links list failed", {
      code: error.code,
      message: error.message,
    });
    return [];
  }
  return data ?? [];
}

export function bitlyConnected(): boolean {
  return Boolean(config.BITLY_ACCESS_TOKEN);
}

function bitlyFromConfig(): BitlyClient | null {
  if (!config.BITLY_ACCESS_TOKEN) return null;
  return createBitlyClient({ accessToken: config.BITLY_ACCESS_TOKEN });
}
