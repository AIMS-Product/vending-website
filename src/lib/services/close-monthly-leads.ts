import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveChannel } from "@/lib/analytics/channel";
import { collapseToLeads } from "@/lib/analytics/lead-definition";
import { isChatbotCapture } from "@/lib/services/admin-analytics-internal";
import { leadsKey } from "@/lib/services/close-monthly-funnel";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const PAGE_SIZE = 1000;

/**
 * The Close funnel each of our own channels files under.
 *
 * Close names the source on the lead ("Funnel Name DEAL (Opp)"); our own
 * tables name it from the UTMs. They are two vocabularies for one thing, and
 * this is the whole of the join. It is deliberately short: a funnel absent
 * from it gets no leads cell at all rather than a zero, because most of what
 * is missing (LTF, the reactivation lanes) has no form behind it and a 0 there
 * would read as a channel that stopped converting.
 */
const FUNNEL_CHANNELS: ReadonlyArray<
  readonly [funnel: string, channel: string]
> = [
  ["YouTube", "YouTube"],
  ["Instagram", "Instagram"],
  ["Anthony IG", "Instagram"],
  ["Website", "Website"],
  ["Website - OG - Cam", "Website"],
  ["Internal Webinar", "Webinar"],
  ["Meta Ads", "Meta Ads"],
  ["Google Ads", "Google Ads"],
  ["Linkedin", "LinkedIn"],
  ["LinkedIn Ads", "LinkedIn"],
  ["VSL", "VSL"],
  ["X", "X"],
  ["Anthony X", "X"],
  ["Mike Newsletter", "Newsletter"],
  ["Newsletter", "Newsletter"],
];

/**
 * The funnel a channel's leads land on: the first one listed for it.
 *
 * A channel feeding several funnels (Instagram and "Anthony IG") lands whole
 * on the first rather than being split by a guess, so the column never invents
 * a division Close does not record.
 */
const FUNNEL_FOR_CHANNEL = new Map(
  [...FUNNEL_CHANNELS]
    .reverse()
    .map(([funnel, channel]) => [channel, funnel] as const),
);

/** The Close funnel a channel's leads are shown under, if it has one. */
export function funnelForChannel(channel: string): string | undefined {
  return FUNNEL_FOR_CHANNEL.get(channel);
}

export type MonthlyLeads = {
  /** Keyed `<month>|<Close funnel>`. */
  byFunnel: Map<string, number>;
  /**
   * Keyed `<month>|<channel>`, every channel including those with no funnel,
   * so the audit can see what the grid leaves out.
   */
  byChannel: Map<string, number>;
  /** The oldest form fill we hold. Nothing before it can be reported. */
  from: string | null;
};

/**
 * Form fills per month, mapped onto the Close funnel names the grid uses.
 *
 * Counted with the same `collapseToLeads` every other tab uses, so "leads"
 * means one person, not one submission, and the number agrees with the
 * Channels and KPI tabs rather than being a fourth answer.
 */
export async function getMonthlyLeads(
  client: Client,
  input: { from: string; to: string; includeInternal?: boolean },
): Promise<MonthlyLeads> {
  const rows: Array<{
    email: string | null;
    created_at: string;
    full_name: string | null;
    lifecycle_status: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    metadata: unknown;
  }> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from("lead_submissions")
      .select(
        "email,created_at,full_name,lifecycle_status,utm_source,utm_medium,metadata",
      )
      .gte("created_at", `${input.from}T00:00:00Z`)
      .lte("created_at", `${input.to}T23:59:59Z`)
      .order("created_at")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error)
      throw new Error(`lead_submissions read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }

  const leads = collapseToLeads(rows, {
    includeInternal: input.includeInternal,
  });

  const byFunnel = new Map<string, number>();
  const byChannel = new Map<string, number>();
  let earliest: string | null = null;
  for (const lead of leads) {
    const day = lead.created_at.slice(0, 10);
    if (!earliest || day < earliest) earliest = day;
    const { channel } = resolveChannel(lead.utm_source, {
      capturedByChatbot:
        !lead.utm_source?.trim() && isChatbotCapture(lead.metadata),
      medium: lead.utm_medium,
    });
    const channelKey = `${day.slice(0, 7)}|${channel}`;
    byChannel.set(channelKey, (byChannel.get(channelKey) ?? 0) + 1);
    const funnel = FUNNEL_FOR_CHANNEL.get(channel);
    // A channel with no Close funnel behind it gets no cell, never a zero.
    if (!funnel) continue;
    const key = leadsKey(day.slice(0, 7), funnel);
    byFunnel.set(key, (byFunnel.get(key) ?? 0) + 1);
  }
  return { byFunnel, byChannel, from: earliest };
}
