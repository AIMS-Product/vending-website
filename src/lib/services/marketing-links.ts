import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  collapseToLeads,
  type LeadLike,
} from "@/lib/analytics/lead-definition";
import {
  buildStandardLink,
  checkLinkUtms,
  isImportedLink,
  linkStandardSchema,
  toContentId,
  toLinkSlug,
} from "@/lib/analytics/link-standard";
import { createBitlyClient, type BitlyClient } from "@/lib/bitly/client";
import { config } from "@/lib/config";
import {
  buildLinkStats,
  type LinkStats,
  type StatsBooking,
  type StatsClick,
  type StatsLead,
} from "@/lib/services/marketing-link-stats";
import { readAllPages } from "@/lib/services/paged-read";
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
    // Cleaned the way the builder previews it, so "MH Podcast" is never an
    // error, just "mh-podcast".
    campaign: toLinkSlug(input.campaign),
    content: toContentId(input.content),
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
  deps: { client?: LinksClient } = {},
): Promise<MarketingLink[]> {
  const client = deps.client ?? createAdminClient();
  const { rows, error } = await readAllPages<MarketingLink>((from, to, count) =>
    client
      .from("marketing_links")
      .select("*", { count })
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  if (error) {
    // The table lands with its own migration; a deploy that beats it shows an
    // empty registry rather than a broken page.
    console.error("marketing links list failed", {
      code: error.code,
      message: error.message,
    });
    return [];
  }
  return rows;
}

export type RegistryLink = MarketingLink & {
  /** Imported from links already in the wild, not built here. */
  imported: boolean;
  /** What the link standard says is wrong with it; empty when on standard. */
  problems: string[];
  /** Null when the result reads failed: unknown, never zero. */
  stats: LinkStats | null;
};

/**
 * The registry with each link's results. A failed results read leaves every
 * `stats` null and says so, because a column of zeros would tell the team
 * their links did nothing.
 */
export async function getLinkRegistry(
  deps: { client?: LinksClient } = {},
): Promise<{ links: RegistryLink[]; statsFailed: boolean }> {
  const client = deps.client ?? createAdminClient();
  const [links, leads, bookings, clicks] = await Promise.all([
    listMarketingLinks({ client }),
    readAllPages<StatsLead & LeadLike>((from, to, count) =>
      client
        .from("lead_submissions")
        .select(
          "created_at,email,full_name,lifecycle_status,call_booked_at,utm_source,utm_medium,utm_campaign,utm_content,utm_term",
          { count },
        )
        .order("created_at")
        .range(from, to),
    ),
    readAllPages<StatsBooking>((from, to, count) =>
      client
        .from("calendly_bookings")
        .select(
          "invitee_email,status,utm_source,utm_medium,utm_campaign,utm_content,utm_term",
          { count },
        )
        .or("utm_source.not.is.null,utm_campaign.not.is.null")
        .order("created_at")
        .range(from, to),
    ),
    readAllPages<StatsClick>((from, to, count) =>
      client
        .from("bitly_link_clicks")
        .select("bitly_id,clicks", { count })
        .order("day")
        .range(from, to),
    ),
  ]);

  const failed = [leads, bookings, clicks].find((read) => read.error);
  if (failed?.error) {
    console.error("link registry results read failed", {
      code: failed.error.code,
      message: failed.error.message,
    });
  }
  const stats = failed
    ? null
    : buildLinkStats({
        links,
        leads: collapseToLeads(leads.rows),
        bookings: bookings.rows,
        clicks: clicks.rows,
      });

  return {
    statsFailed: Boolean(failed),
    links: links.map((link) => ({
      ...link,
      imported: isImportedLink(link.created_by),
      problems: checkLinkUtms({
        source: link.utm_source || null,
        medium: link.utm_medium || null,
        campaign: link.utm_campaign || null,
        content: link.utm_content || null,
        term: link.utm_term || null,
      }).problems,
      stats: stats ? (stats.get(link.id) ?? null) : null,
    })),
  };
}

export function bitlyConnected(): boolean {
  return Boolean(config.BITLY_ACCESS_TOKEN);
}

function bitlyFromConfig(): BitlyClient | null {
  if (!config.BITLY_ACCESS_TOKEN) return null;
  return createBitlyClient({ accessToken: config.BITLY_ACCESS_TOKEN });
}
